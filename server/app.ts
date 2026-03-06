import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import mammoth from "mammoth";
import multer from "multer";
import WordExtractor from "word-extractor";
import { nanoid } from "nanoid";
import { EventHub } from "./events.js";
import { getSessionUrls } from "./network.js";
import { LibraryStore } from "./storage.js";
import type {
  CreateFolderRequest,
  DeleteItemResponse,
  ItemPreview,
  SessionInfo
} from "../shared/types.js";

interface CreateAppOptions {
  port?: number;
  seedDemo?: boolean;
  storageRoot?: string;
  staticDir?: string;
}

const wordExtractor = new WordExtractor();

function parseRangeHeader(rangeHeader: string, fileSize: number) {
  const matches = /bytes=(\d*)-(\d*)/.exec(rangeHeader);

  if (!matches) {
    return null;
  }

  const [, startString, endString] = matches;
  const start = startString ? Number.parseInt(startString, 10) : 0;
  const end = endString ? Number.parseInt(endString, 10) : fileSize - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= fileSize) {
    return null;
  }

  return { start, end };
}

function normalizeParentId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => (typeof entry === "string" ? [entry] : []));
  }

  return typeof value === "string" ? [value] : [];
}

function buildPreviewText(text: string, source: "text" | "word"): ItemPreview {
  const compacted = text.replace(/\r\n/g, "\n").trim();
  const limited = compacted.slice(0, 8000);

  return {
    mode: "text",
    source,
    text: limited,
    truncated: compacted.length > limited.length
  };
}

async function createItemPreview(
  item: NonNullable<ReturnType<LibraryStore["findItem"]>>,
  filePath: string
): Promise<ItemPreview> {
  if (item.kind === "folder") {
    return {
      mode: "folder",
      childCount: item.childrenCount ?? 0
    };
  }

  if (item.mimeType.includes("pdf")) {
    return {
      mode: "pdf",
      url: item.contentUrl ?? item.downloadUrl ?? ""
    };
  }

  const extension = path.extname(item.name).toLowerCase();

  if (
    item.mimeType.startsWith("text/") ||
    item.mimeType.includes("json") ||
    extension === ".md" ||
    extension === ".txt"
  ) {
    const text = await readFile(filePath, "utf8");
    return buildPreviewText(text, "text");
  }

  if (extension === ".docx") {
    const extracted = await mammoth.extractRawText({ path: filePath });
    return buildPreviewText(extracted.value, "word");
  }

  if (extension === ".doc") {
    const extracted = await wordExtractor.extract(filePath);
    return buildPreviewText(extracted.getBody(), "word");
  }

  return {
    mode: "none",
    notice: "Anteprima non disponibile per questo formato."
  };
}

export async function createApp(options: CreateAppOptions = {}) {
  const port = options.port ?? 8787;
  const storageRoot = options.storageRoot ?? path.resolve(process.cwd(), "storage");
  const urls = getSessionUrls(port);
  const store = new LibraryStore(storageRoot);
  const events = new EventHub();

  await store.init({ seedDemo: options.seedDemo });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        callback(null, store.libraryDir);
      },
      filename: (_request, file, callback) => {
        const id = nanoid(10);
        callback(null, store.buildStoredName(id, file.originalname));
      }
    })
  });

  const app = express();

  async function resolveExistingFile(itemId: string, response: express.Response) {
    const item = store.findItem(itemId);

    if (!item || item.kind === "folder") {
      response.status(404).json({ message: "File non trovato." });
      return null;
    }

    const filePath = store.resolveItemPath(item);

    try {
      await stat(filePath);
      return { item, filePath };
    } catch {
      response.status(404).json({ message: "File non disponibile sul disco host." });
      return null;
    }
  }

  function broadcastLibraryUpdated(changedIds: string[] = []) {
    events.broadcast("library-updated", {
      itemCount: store.getSummary().itemCount,
      latestIds: changedIds
    });
  }

  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/session", (_request, response) => {
    const summary = store.getSummary();
    const sessionInfo: SessionInfo = {
      appName: "Routeroom",
      hostName: os.hostname(),
      lanUrl: urls.lanUrl,
      storagePath: store.rootDir,
      ...summary
    };

    response.json(sessionInfo);
  });

  app.get("/api/items", (_request, response) => {
    response.json(store.getItems());
  });

  app.post("/api/folders", async (request, response, next) => {
    try {
      const payload = request.body as CreateFolderRequest;

      if (!payload || typeof payload.name !== "string") {
        response.status(400).json({ message: "Nome cartella mancante." });
        return;
      }

      const folder = await store.createFolder(payload.name, normalizeParentId(payload.parentId));
      broadcastLibraryUpdated([folder.id]);
      response.status(201).json({ item: folder });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid parent folder") {
        response.status(400).json({ message: "Cartella padre non valida." });
        return;
      }

      next(error);
    }
  });

  app.post("/api/items", upload.array("files"), async (request, response, next) => {
    try {
      const files = (request.files as Express.Multer.File[] | undefined) ?? [];
      const parentId = normalizeParentId(request.body.parentId);
      const relativePaths = normalizeStringArray(request.body.relativePaths);

      if (files.length === 0) {
        response.status(400).json({ message: "Nessun file ricevuto." });
        return;
      }

      const items =
        relativePaths.length === files.length
          ? await store.registerUploadsWithPaths(files, relativePaths, parentId)
          : await store.registerUploads(files, parentId);
      broadcastLibraryUpdated(items.map((item) => item.id));
      response.status(201).json({ items });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid parent folder") {
        response.status(400).json({ message: "Cartella padre non valida." });
        return;
      }

      next(error);
    }
  });

  app.delete("/api/items/:id", async (request, response, next) => {
    try {
      const deletedIds = await store.deleteItem(request.params.id);

      if (!deletedIds) {
        response.status(404).json({ message: "Elemento non trovato." });
        return;
      }

      broadcastLibraryUpdated(deletedIds);

      const payload: DeleteItemResponse = {
        deletedIds
      };
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/items/:id/download", async (request, response) => {
    const resolved = await resolveExistingFile(request.params.id, response);

    if (!resolved) {
      return;
    }

    response.download(resolved.filePath, resolved.item.name);
  });

  app.get("/api/items/:id/content", async (request, response) => {
    const resolved = await resolveExistingFile(request.params.id, response);

    if (!resolved) {
      return;
    }

    const fileStats = await stat(resolved.filePath);
    response.status(200).set({
      "Content-Length": String(fileStats.size),
      "Content-Type": resolved.item.mimeType
    });
    createReadStream(resolved.filePath).pipe(response);
  });

  app.get("/api/items/:id/preview", async (request, response, next) => {
    try {
      const item = store.findItem(request.params.id);

      if (!item) {
        response.status(404).json({ message: "Elemento non trovato." });
        return;
      }

      if (item.kind === "folder") {
        response.json({
          mode: "folder",
          childCount: item.childrenCount ?? 0
        } satisfies ItemPreview);
        return;
      }

      const resolved = await resolveExistingFile(request.params.id, response);

      if (!resolved) {
        return;
      }

      const preview = await createItemPreview(resolved.item, resolved.filePath);
      response.json(preview);
    } catch (error) {
      console.error(error);
      response.status(200).json({
        mode: "none",
        notice: "Anteprima non disponibile per questo formato."
      } satisfies ItemPreview);
    }
  });

  app.get("/api/items/:id/stream", async (request, response) => {
    const item = store.findItem(request.params.id);

    if (!item || !item.streamUrl) {
      response.status(404).json({ message: "Media non disponibile per lo streaming." });
      return;
    }

    const filePath = store.resolveItemPath(item);
    const fileStats = await stat(filePath);
    const rangeHeader = request.headers.range;

    if (rangeHeader) {
      const range = parseRangeHeader(rangeHeader, fileStats.size);

      if (!range) {
        response.status(416).setHeader("Content-Range", `bytes */${fileStats.size}`).end();
        return;
      }

      const { start, end } = range;
      response.status(206).set({
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileStats.size}`,
        "Content-Type": item.mimeType
      });

      createReadStream(filePath, { start, end }).pipe(response);
      return;
    }

    response.status(200).set({
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileStats.size),
      "Content-Type": item.mimeType
    });
    createReadStream(filePath).pipe(response);
  });

  app.get("/api/events", (request, response) => {
    response.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    });
    response.write(": connected\n\n");
    events.addClient(response);

    request.on("close", () => {
      events.removeClient(response);
    });
  });

  const keepAliveInterval = setInterval(() => {
    events.keepAlive();
  }, 15000);

  if (options.staticDir && existsSync(options.staticDir)) {
    app.use(express.static(options.staticDir));
    app.get("/{*path}", (request, response, next) => {
      if (request.path.startsWith("/api/")) {
        next();
        return;
      }

      response.sendFile(path.join(options.staticDir!, "index.html"));
    });
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({ message: "Errore interno del server." });
  });

  return {
    app,
    store,
    urls,
    close() {
      clearInterval(keepAliveInterval);
    }
  };
}
