import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { EventHub } from "./events.js";
import { getSessionUrls } from "./network.js";
import { LibraryStore } from "./storage.js";
import type { SessionInfo } from "../shared/types.js";

interface CreateAppOptions {
  port?: number;
  storageRoot?: string;
  staticDir?: string;
}

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

export async function createApp(options: CreateAppOptions = {}) {
  const port = options.port ?? 8787;
  const storageRoot = options.storageRoot ?? path.resolve(process.cwd(), "storage");
  const urls = getSessionUrls(port);
  const store = new LibraryStore(storageRoot);
  const events = new EventHub();

  await store.init();

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

    if (!item) {
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

  app.post("/api/items", upload.array("files"), async (request, response, next) => {
    try {
      const files = (request.files as Express.Multer.File[] | undefined) ?? [];

      if (files.length === 0) {
        response.status(400).json({ message: "Nessun file ricevuto." });
        return;
      }

      const items = await store.registerUploads(files);
      events.broadcast("library-updated", {
        itemCount: store.getSummary().itemCount,
        latestIds: items.map((item) => item.id)
      });

      response.status(201).json({ items });
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
