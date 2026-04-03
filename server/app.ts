import { createReadStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import mammoth from "mammoth";
import multer from "multer";
import WordExtractor from "word-extractor";
import { nanoid } from "nanoid";
import { EventHub } from "./events.js";
import { getSessionUrls } from "./network.js";
import { CollaborationStore } from "./realtime.js";
import { SyncStore } from "./sync.js";
import { LibraryStore } from "./storage.js";
import { collectHostDiagnostics, HostRuntimeStatsMonitor } from "./diagnostics.js";
import type {
  ArchiveFormat,
  ChatSnapshotResponse,
  ClearGlobalChatResponse,
  ClientProfileResponse,
  DirectChatSnapshotResponse,
  CreateStreamRoomRequest,
  CreateStreamRoomResponse,
  CreatePairingCodeResponse,
  CreateArchiveRequest,
  CreateArchiveResponse,
  CreateFolderRequest,
  DeleteStreamRoomResponse,
  DeleteItemResponse,
  HostDiagnosticsResponse,
  HostRuntimeStatsResponse,
  ItemPreview,
  PlanSyncMappingRequest,
  PlanSyncMappingResponse,
  PostChatMessageRequest,
  PostRoomMessageRequest,
  RegisterSyncDeviceRequest,
  RegisterSyncDeviceResponse,
  SendChatMessageResponse,
  SendPrivateChatMessageResponse,
  SendRoomMessageResponse,
  SetStreamRoomVideoRequest,
  SetStreamRoomVideoResponse,
  SyncDeviceConfigResponse,
  SyncOverviewResponse,
  SyncUploadResponse,
  UpdateSyncUploadProgressRequest,
  UpdateSyncFoldersRequest,
  SessionInfo,
  StreamRoomDetail,
  StreamRoomResponse,
  StreamRoomsResponse,
  StreamRoomSummary,
  UpdateStreamRoomPlaybackRequest,
  UpdateStreamRoomPlaybackResponse
} from "../shared/types.js";
import {
  createFolderArchive,
  detectAvailableArchiveFormats,
  getArchiveMimeType,
  streamFolderArchiveAsZip
} from "./archive.js";

interface CreateAppOptions {
  port?: number;
  seedDemo?: boolean;
  storageRoot?: string;
  staticDir?: string;
  listenHost?: string;
  appVersion?: string;
}

const wordExtractor = new WordExtractor();
const previewCharacterLimit = 2800;

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

function normalizeNumberArray(value: unknown) {
  return normalizeStringArray(value)
    .map((entry) => Number.parseInt(entry, 10))
    .filter((entry) => Number.isFinite(entry));
}

function normalizeRouteParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? "" : "";
}

function normalizeArchiveFormat(value: unknown): ArchiveFormat | null {
  return value === "zip" || value === "7z" || value === "rar" ? value : null;
}

function normalizeClientIp(value: string | undefined) {
  if (!value) {
    return null;
  }

  const withoutMappedPrefix = value.startsWith("::ffff:") ? value.slice(7) : value;
  const withoutZone = withoutMappedPrefix.split("%")[0] ?? withoutMappedPrefix;

  return withoutZone === "::1" ? "127.0.0.1" : withoutZone.toLowerCase();
}

function collectHostIpAddresses() {
  const addresses = new Set<string>(["127.0.0.1"]);

  for (const interfaceAddresses of Object.values(os.networkInterfaces())) {
    for (const interfaceAddress of interfaceAddresses ?? []) {
      const normalizedAddress = normalizeClientIp(interfaceAddress.address);

      if (normalizedAddress) {
        addresses.add(normalizedAddress);
      }
    }
  }

  return addresses;
}

function isHostRequest(request: express.Request, hostIpAddresses: Set<string>) {
  const clientIp = normalizeClientIp(request.ip || request.socket.remoteAddress);
  const localAddress = normalizeClientIp(request.socket.localAddress);

  if (!clientIp) {
    return false;
  }

  return clientIp === "127.0.0.1" || (localAddress !== null && clientIp === localAddress) || hostIpAddresses.has(clientIp);
}

function buildPreviewText(text: string, source: "text" | "word"): ItemPreview {
  const compacted = text.replace(/\r\n/g, "\n").trim();
  const limited = compacted.slice(0, previewCharacterLimit).trimEnd();

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

async function resolveAppVersion(explicitVersion?: string) {
  const normalizedExplicitVersion = explicitVersion?.trim();

  if (normalizedExplicitVersion) {
    return normalizedExplicitVersion;
  }

  const envVersion = process.env.npm_package_version?.trim();

  if (envVersion) {
    return envVersion;
  }

  const packageJsonCandidates = [
    path.resolve(process.cwd(), "package.json"),
    fileURLToPath(new URL("../package.json", import.meta.url)),
    fileURLToPath(new URL("../../package.json", import.meta.url))
  ];

  for (const candidatePath of packageJsonCandidates) {
    if (!existsSync(candidatePath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(await readFile(candidatePath, "utf8")) as {
        version?: string;
      };
      const fileVersion = parsed.version?.trim();

      if (fileVersion) {
        return fileVersion;
      }
    } catch {
      continue;
    }
  }

  return "0.0.0";
}

export async function createApp(options: CreateAppOptions = {}) {
  const port = options.port ?? 8787;
  const listenHost = options.listenHost ?? "0.0.0.0";
  const storageRoot = options.storageRoot ?? path.resolve(process.cwd(), "storage");
  const appVersion = await resolveAppVersion(options.appVersion);
  const urls = getSessionUrls(port);
  const store = new LibraryStore(storageRoot);
  const collaboration = new CollaborationStore(storageRoot);
  const sync = new SyncStore(storageRoot);
  const events = new EventHub();
  const runtimeStats = new HostRuntimeStatsMonitor();
  const availableArchiveFormats = await detectAvailableArchiveFormats();
  const hostIpAddresses = collectHostIpAddresses();
  const syncUploadStageDir = path.join(storageRoot, ".sync-upload-stage");
  const defaultFolderDownloadFormat =
    availableArchiveFormats.find((format) => format === "zip") ??
    availableArchiveFormats[0] ??
    null;

  await store.init({ seedDemo: options.seedDemo });
  await collaboration.init();
  await sync.init();
  await mkdir(syncUploadStageDir, { recursive: true });
  await collaboration.pruneMissingVideos((videoItemId) => {
    const item = store.findItem(videoItemId);
    return item?.kind === "video";
  });

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

  const syncUpload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        callback(null, syncUploadStageDir);
      },
      filename: (_request, file, callback) => {
        callback(null, `${nanoid(10)}--${file.originalname}`);
      }
    })
  });

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

  function ensureSupportedArchiveFormat(
    format: ArchiveFormat | null,
    response: express.Response
  ): ArchiveFormat | null {
    if (!format) {
      response.status(400).json({ message: "Formato archivio non valido." });
      return null;
    }

    if (!availableArchiveFormats.includes(format)) {
      response.status(400).json({ message: `Formato ${format} non disponibile su questo host.` });
      return null;
    }

    return format;
  }

  async function createTemporaryArchive(folderId: string, folderName: string, format: ArchiveFormat) {
    const tempDir = await mkdtemp(path.join(store.rootDir, `routeroom-archive-${format}-`));
    const safeFilename = folderName.replace(/[\\/]+/g, "-").slice(0, 80) || "cartella";
    const archivePath = path.join(tempDir, `${safeFilename}.${format}`);
    await createFolderArchive(store, folderId, format, archivePath);
    return { archivePath, tempDir };
  }

  async function sendResolvedFile(
    request: express.Request,
    response: express.Response,
    resolved: NonNullable<Awaited<ReturnType<typeof resolveExistingFile>>>,
    options: { downloadName?: string } = {}
  ) {
    const fileStats = await stat(resolved.filePath);
    const rangeHeader = request.headers.range;

    if (options.downloadName) {
      response.attachment(options.downloadName);
    }

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
        "Content-Type": resolved.item.mimeType
      });
      createReadStream(resolved.filePath, { start, end }).pipe(response);
      return;
    }

    response.status(200).set({
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileStats.size),
      "Content-Type": resolved.item.mimeType
    });
    createReadStream(resolved.filePath).pipe(response);
  }

  function broadcastLibraryUpdated(changedIds: string[] = []) {
    events.broadcast("library-updated", {
      itemCount: store.getSummary().itemCount,
      latestIds: changedIds
    });
  }

  function buildRoomSummary(
    room: NonNullable<ReturnType<CollaborationStore["findRoom"]>>
  ): StreamRoomSummary {
    const videoItem =
      room.playback.videoItemId ? store.findItem(room.playback.videoItemId) ?? null : null;

    return {
      id: room.id,
      name: room.name,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      currentVideoName: videoItem?.kind === "video" ? videoItem.name : null,
      messageCount: collaboration.getRoomMessages(room.id).length,
      playback: collaboration.materializePlayback(room)
    };
  }

  function buildRoomDetail(
    room: NonNullable<ReturnType<CollaborationStore["findRoom"]>>
  ): StreamRoomDetail {
    const videoItem =
      room.playback.videoItemId ? store.findItem(room.playback.videoItemId) ?? null : null;

    return {
      ...buildRoomSummary(room),
      videoItem: videoItem?.kind === "video" ? videoItem : null,
      messages: collaboration.getRoomMessages(room.id)
    };
  }

  function broadcastGlobalChatUpdated() {
    events.broadcast("chat-global-updated", {
      count: collaboration.getGlobalMessages().length
    });
  }

  function broadcastPrivateChatUpdated(participantIds: string[]) {
    events.broadcast("chat-private-updated", {
      participantIds
    });
  }

  function broadcastRoomCreated(roomId: string) {
    events.broadcast("stream-room-created", {
      roomId
    });
  }

  function broadcastRoomUpdated(roomId: string) {
    events.broadcast("stream-room-updated", {
      roomId
    });
  }

  function broadcastRoomDeleted(roomId: string) {
    events.broadcast("stream-room-deleted", {
      roomId
    });
  }

  function broadcastRoomChatUpdated(roomId: string) {
    events.broadcast("stream-room-chat-updated", {
      roomId
    });
  }

  function broadcastSyncUpdated() {
    events.broadcast("sync-updated", {
      deviceCount: sync.getOverview().devices.length
    });
  }

  function readBearerToken(request: express.Request) {
    const authorization = request.get("authorization") ?? "";

    if (!authorization.startsWith("Bearer ")) {
      return null;
    }

    return authorization.slice("Bearer ".length).trim() || null;
  }

  function requireSyncDevice(request: express.Request) {
    const token = readBearerToken(request);

    if (!token) {
      return null;
    }

    return sync.authenticate(token);
  }

  app.use(runtimeStats.createTrafficMiddleware());
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/me", (request, response) => {
    const payload: ClientProfileResponse = {
      clientIp: normalizeClientIp(request.ip || request.socket.remoteAddress),
      userAgent: typeof request.get("user-agent") === "string" ? request.get("user-agent") ?? null : null,
      isHost: isHostRequest(request, hostIpAddresses)
    };

    response.json(payload);
  });

  app.get("/api/session", (_request, response) => {
    const summary = store.getSummary();
    const sessionInfo: SessionInfo = {
      appName: "Routy",
      appVersion,
      hostName: os.hostname(),
      lanUrl: urls.lanUrl,
      storagePath: store.rootDir,
      availableArchiveFormats,
      ...summary
    };

    response.json(sessionInfo);
  });

  app.get("/api/diagnostics", async (_request, response, next) => {
    try {
      const payload: HostDiagnosticsResponse = await collectHostDiagnostics({
        lanUrl: urls.lanUrl,
        listenHost,
        port
      });
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/diagnostics/stats", (request, response) => {
    if (!isHostRequest(request, hostIpAddresses)) {
      response.status(403).json({ message: "Solo l'host puo vedere le metriche live." });
      return;
    }

    const payload: HostRuntimeStatsResponse = runtimeStats.getSnapshot();
    response.json(payload);
  });

  app.get("/api/sync/overview", (request, response) => {
    if (!isHostRequest(request, hostIpAddresses)) {
      response.status(403).json({ message: "Solo l'host puo gestire la sincronizzazione." });
      return;
    }

    const payload: SyncOverviewResponse = sync.getOverview();
    response.json(payload);
  });

  app.post("/api/sync/pairing-code", (request, response) => {
    if (!isHostRequest(request, hostIpAddresses)) {
      response.status(403).json({ message: "Solo l'host puo generare pairing code." });
      return;
    }

    const payload: CreatePairingCodeResponse = sync.createPairingCode();
    broadcastSyncUpdated();
    response.status(201).json(payload);
  });

  app.delete("/api/sync/devices/:deviceId", async (request, response, next) => {
    if (!isHostRequest(request, hostIpAddresses)) {
      response.status(403).json({ message: "Solo l'host puo revocare device sync." });
      return;
    }

    try {
      const revoked = await sync.revokeDevice(request.params.deviceId);

      if (!revoked) {
        response.status(404).json({ message: "Device sync non trovato." });
        return;
      }

      broadcastSyncUpdated();
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sync/register", async (request, response, next) => {
    try {
      const payload = request.body as RegisterSyncDeviceRequest | undefined;

      if (
        !payload ||
        typeof payload.pairingCode !== "string" ||
        typeof payload.deviceName !== "string" ||
        payload.platform !== "android"
      ) {
        response.status(400).json({ message: "Richiesta pairing non valida." });
        return;
      }

      const result: RegisterSyncDeviceResponse = await sync.registerDevice(
        payload.pairingCode,
        payload.deviceName,
        payload.platform,
        store
      );
      broadcastSyncUpdated();
      response.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid pairing code") {
        response.status(400).json({ message: "Pairing code non valido o scaduto." });
        return;
      }

      next(error);
    }
  });

  app.get("/api/sync/device/config", async (request, response, next) => {
    const device = requireSyncDevice(request);

    if (!device) {
      response.status(401).json({ message: "Device sync non autenticato." });
      return;
    }

    try {
      const payload: SyncDeviceConfigResponse = await sync.getDeviceConfig(device.id);
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/sync/device/config", async (request, response, next) => {
    const device = requireSyncDevice(request);

    if (!device) {
      response.status(401).json({ message: "Device sync non autenticato." });
      return;
    }

    try {
      const payload = request.body as UpdateSyncFoldersRequest | undefined;

      if (!payload || !Array.isArray(payload.mappings)) {
        response.status(400).json({ message: "Configurazione sync non valida." });
        return;
      }

      const result = await sync.updateDeviceConfig(device.id, payload, store);
      broadcastSyncUpdated();
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sync/mappings/:mappingId/plan", async (request, response, next) => {
    const device = requireSyncDevice(request);

    if (!device) {
      response.status(401).json({ message: "Device sync non autenticato." });
      return;
    }

    try {
      const payload = request.body as PlanSyncMappingRequest | undefined;

      if (!payload || !Array.isArray(payload.entries)) {
        response.status(400).json({ message: "Piano sync non valido." });
        return;
      }

      const result: PlanSyncMappingResponse = await sync.planMapping(
        device.id,
        normalizeRouteParam(request.params.mappingId),
        payload.entries
      );
      response.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid relative path") {
        response.status(400).json({ message: "Percorso relativo non valido." });
        return;
      }

      if (error instanceof Error && error.message === "Unknown sync mapping") {
        response.status(404).json({ message: "Mapping sync non trovato." });
        return;
      }

      next(error);
    }
  });

  app.post("/api/sync/mappings/:mappingId/upload", syncUpload.array("files"), async (request, response, next) => {
    const device = requireSyncDevice(request);
    const mappingId = normalizeRouteParam(request.params.mappingId);

    if (!device) {
      response.status(401).json({ message: "Device sync non autenticato." });
      return;
    }

    try {
      const files = (request.files as Express.Multer.File[] | undefined) ?? [];
      const relativePaths = normalizeStringArray(request.body.relativePaths);
      const modifiedAtValues = normalizeNumberArray(request.body.modifiedAtMs);

      if (files.length === 0 || files.length !== relativePaths.length || files.length !== modifiedAtValues.length) {
        response.status(400).json({ message: "Payload upload sync non valido." });
        return;
      }

      const result: SyncUploadResponse = await sync.applyUpload(
        device.id,
        mappingId,
        files.map((file, index) => ({
          relativePath: relativePaths[index] ?? file.originalname,
          sizeBytes: file.size,
          modifiedAtMs: modifiedAtValues[index] ?? 0,
          mimeType: file.mimetype,
          sourcePath: "path" in file && typeof file.path === "string" ? file.path : path.join(syncUploadStageDir, file.filename)
        })),
        store
      );
      broadcastLibraryUpdated();
      broadcastSyncUpdated();
      response.status(201).json(result);
    } catch (error) {
      sync.clearActiveUploadProgress(device.id, mappingId);
      broadcastSyncUpdated();

      if (error instanceof Error && error.message === "Unknown sync mapping") {
        response.status(404).json({ message: "Mapping sync non trovato." });
        return;
      }

      next(error);
    }
  });

  app.put("/api/sync/mappings/:mappingId/progress", (request, response, next) => {
    const device = requireSyncDevice(request);

    if (!device) {
      response.status(401).json({ message: "Device sync non autenticato." });
      return;
    }

    const payload = request.body as UpdateSyncUploadProgressRequest | undefined;

    if (
      !payload ||
      typeof payload.uploadedBytes !== "number" ||
      typeof payload.totalBytes !== "number" ||
      typeof payload.uploadedFiles !== "number" ||
      typeof payload.totalFiles !== "number"
    ) {
      response.status(400).json({ message: "Progress sync non valido." });
      return;
    }

    try {
      sync.updateActiveUploadProgress(device.id, normalizeRouteParam(request.params.mappingId), payload);
      broadcastSyncUpdated();
      response.status(204).end();
    } catch (error) {
      if (error instanceof Error && error.message === "Unknown sync mapping") {
        response.status(404).json({ message: "Mapping sync non trovato." });
        return;
      }

      next(error);
    }
  });

  app.get("/api/items", (_request, response) => {
    response.json(store.getItems());
  });

  app.get("/api/chat", (request, response) => {
    const viewerId = typeof request.query.viewerId === "string" ? request.query.viewerId.trim() : "";
    const payload: ChatSnapshotResponse = {
      globalMessages: collaboration.getGlobalMessages(),
      threads: viewerId ? collaboration.listPrivateThreads(viewerId) : [],
      knownUsers: collaboration.getKnownUsers()
    };

    response.json(payload);
  });

  app.post("/api/chat/messages", async (request, response, next) => {
    try {
      const payload = request.body as PostChatMessageRequest | undefined;

      if (
        !payload ||
        typeof payload.text !== "string" ||
        typeof payload.identity?.nickname !== "string"
      ) {
        response.status(400).json({ message: "Messaggio o nickname non validi." });
        return;
      }

      const message = await collaboration.addGlobalMessage(payload.identity, payload.text);
      broadcastGlobalChatUpdated();

      const result: SendChatMessageResponse = { message };
      response.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid message") {
        response.status(400).json({ message: "Messaggio o nickname non validi." });
        return;
      }

      next(error);
    }
  });

  app.delete("/api/chat/messages", async (request, response, next) => {
    if (!isHostRequest(request, hostIpAddresses)) {
      response.status(403).json({ message: "Solo l'host puo svuotare la chat globale." });
      return;
    }

    try {
      const clearedMessages = await collaboration.clearGlobalMessages();
      broadcastGlobalChatUpdated();

      const payload: ClearGlobalChatResponse = {
        clearedMessages
      };

      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/chat/users/:id", (request, response) => {
    const viewerId = typeof request.query.viewerId === "string" ? request.query.viewerId.trim() : "";

    if (!viewerId) {
      response.status(400).json({ message: "Utente richiedente mancante." });
      return;
    }

    const participant = collaboration.findKnownUser(request.params.id);
    const payload: DirectChatSnapshotResponse = {
      participant,
      messages: collaboration.getPrivateMessages(viewerId, request.params.id),
      knownUsers: collaboration.getKnownUsers()
    };

    response.json(payload);
  });

  app.post("/api/chat/users/:id/messages", async (request, response, next) => {
    try {
      const payload = request.body as PostChatMessageRequest | undefined;

      if (
        !payload ||
        typeof payload.text !== "string" ||
        typeof payload.identity?.nickname !== "string"
      ) {
        response.status(400).json({ message: "Messaggio o nickname non validi." });
        return;
      }

      const recipient = collaboration.findKnownUser(request.params.id);

      if (!recipient) {
        response.status(404).json({ message: "Utente non trovato." });
        return;
      }

      const message = await collaboration.addPrivateMessage(payload.identity, recipient, payload.text);
      broadcastPrivateChatUpdated([message.identity.id, recipient.id]);

      const result: SendPrivateChatMessageResponse = { message };
      response.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid message") {
        response.status(400).json({ message: "Messaggio o nickname non validi." });
        return;
      }

      next(error);
    }
  });

  app.get("/api/stream/rooms", (_request, response) => {
    const payload: StreamRoomsResponse = {
      rooms: collaboration.listRooms().map(buildRoomSummary)
    };

    response.json(payload);
  });

  app.post("/api/stream/rooms", async (request, response, next) => {
    try {
      const payload = request.body as CreateStreamRoomRequest | undefined;

      if (!payload || typeof payload.name !== "string") {
        response.status(400).json({ message: "Nome stanza mancante." });
        return;
      }

      const room = await collaboration.createRoom(payload.name);
      broadcastRoomCreated(room.id);

      const result: CreateStreamRoomResponse = {
        room: buildRoomSummary(room)
      };
      response.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Room name required") {
        response.status(400).json({ message: "Nome stanza mancante." });
        return;
      }

      next(error);
    }
  });

  app.get("/api/stream/rooms/:id", (request, response) => {
    const room = collaboration.findRoom(request.params.id);

    if (!room) {
      response.status(404).json({ message: "Stanza non trovata." });
      return;
    }

    const payload: StreamRoomResponse = {
      room: buildRoomDetail(room)
    };

    response.json(payload);
  });

  app.delete("/api/stream/rooms/:id", async (request, response, next) => {
    try {
      const deleted = await collaboration.deleteRoom(request.params.id);

      if (!deleted) {
        response.status(404).json({ message: "Stanza non trovata." });
        return;
      }

      broadcastRoomDeleted(request.params.id);

      const payload: DeleteStreamRoomResponse = {
        deletedRoomId: request.params.id
      };
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/stream/rooms/:id/messages", async (request, response, next) => {
    try {
      const payload = request.body as PostRoomMessageRequest | undefined;

      if (
        !payload ||
        typeof payload.text !== "string" ||
        typeof payload.identity?.nickname !== "string"
      ) {
        response.status(400).json({ message: "Messaggio o nickname non validi." });
        return;
      }

      const message = await collaboration.addRoomMessage(request.params.id, payload.identity, payload.text);

      if (!message) {
        response.status(404).json({ message: "Stanza non trovata." });
        return;
      }

      broadcastRoomChatUpdated(request.params.id);
      broadcastRoomUpdated(request.params.id);

      const result: SendRoomMessageResponse = {
        message
      };
      response.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid message") {
        response.status(400).json({ message: "Messaggio o nickname non validi." });
        return;
      }

      next(error);
    }
  });

  app.post("/api/stream/rooms/:id/video", async (request, response, next) => {
    try {
      const payload = request.body as SetStreamRoomVideoRequest | undefined;

      if (!payload || typeof payload.videoItemId !== "string") {
        response.status(400).json({ message: "Video stanza non valido." });
        return;
      }

      const item = store.findItem(payload.videoItemId);

      if (!item || item.kind !== "video") {
        response.status(400).json({ message: "Seleziona un video valido dalla libreria." });
        return;
      }

      const room = await collaboration.setRoomVideo(request.params.id, item.id);

      if (!room) {
        response.status(404).json({ message: "Stanza non trovata." });
        return;
      }

      broadcastRoomUpdated(request.params.id);

      const result: SetStreamRoomVideoResponse = {
        room: buildRoomDetail(room)
      };
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/stream/rooms/:id/playback", async (request, response, next) => {
    try {
      const payload = request.body as UpdateStreamRoomPlaybackRequest | undefined;

      if (
        !payload ||
        (payload.action !== "play" && payload.action !== "pause" && payload.action !== "seek") ||
        typeof payload.positionSeconds !== "number"
      ) {
        response.status(400).json({ message: "Comando playback non valido." });
        return;
      }

      const room = await collaboration.updatePlayback(
        request.params.id,
        payload.action,
        payload.positionSeconds
      );

      if (!room) {
        response.status(404).json({ message: "Stanza non trovata." });
        return;
      }

      broadcastRoomUpdated(request.params.id);

      const result: UpdateStreamRoomPlaybackResponse = {
        room: buildRoomDetail(room)
      };
      response.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Missing room video") {
        response.status(400).json({ message: "Seleziona prima un video per la stanza." });
        return;
      }

      next(error);
    }
  });

  app.get("/api/items/:id", (request, response) => {
    const item = store.findItem(request.params.id);

    if (!item) {
      response.status(404).json({ message: "Elemento non trovato." });
      return;
    }

    response.json(item);
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
      const changedRoomIds = await collaboration.clearDeletedVideos(deletedIds);

      for (const roomId of changedRoomIds) {
        broadcastRoomUpdated(roomId);
      }

      const payload: DeleteItemResponse = {
        deletedIds
      };
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/items/:id/download", async (request, response, next) => {
    try {
      const item = store.findItem(request.params.id);

      if (!item) {
        response.status(404).json({ message: "Elemento non trovato." });
        return;
      }

      if (item.kind === "folder") {
        const format = ensureSupportedArchiveFormat(
          normalizeArchiveFormat(request.query.format) ?? defaultFolderDownloadFormat,
          response
        );

        if (!format) {
          return;
        }

        if (format === "zip") {
          response.setHeader("Content-Type", getArchiveMimeType(format));
          response.attachment(`${item.name}.${format}`);
          const archive = streamFolderArchiveAsZip(store, item.id, response);

          response.on("close", () => {
            if (!response.writableFinished) {
              archive.abort();
            }
          });

          return;
        }

        const { archivePath, tempDir } = await createTemporaryArchive(item.id, item.name, format);
        let cleaned = false;
        const cleanup = async () => {
          if (cleaned) {
            return;
          }

          cleaned = true;
          await rm(tempDir, { recursive: true, force: true });
        };

        response.on("finish", () => {
          void cleanup();
        });
        response.on("close", () => {
          void cleanup();
        });

        response.download(archivePath, `${item.name}.${format}`);
        return;
      }

      const resolved = await resolveExistingFile(request.params.id, response);

      if (!resolved) {
        return;
      }

      await sendResolvedFile(request, response, resolved, {
        downloadName: resolved.item.name
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/items/:id/archive", async (request, response, next) => {
    try {
      const item = store.findItem(request.params.id);

      if (!item || item.kind !== "folder") {
        response.status(404).json({ message: "Cartella non trovata." });
        return;
      }

      const payload = request.body as CreateArchiveRequest | undefined;
      const format = ensureSupportedArchiveFormat(normalizeArchiveFormat(payload?.format), response);

      if (!format) {
        return;
      }

      const { archivePath, tempDir } = await createTemporaryArchive(item.id, item.name, format);

      try {
        const archiveItem = await store.registerGeneratedFile(
          archivePath,
          `${item.name}.${format}`,
          getArchiveMimeType(format),
          item.parentId
        );
        broadcastLibraryUpdated([archiveItem.id]);

        const result: CreateArchiveResponse = {
          item: archiveItem
        };
        response.status(201).json(result);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/items/:id/content", async (request, response) => {
    const resolved = await resolveExistingFile(request.params.id, response);

    if (!resolved) {
      return;
    }

    await sendResolvedFile(request, response, resolved);
  });

  app.get("/api/items/:id/preview", async (request, response) => {
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

    const resolved = await resolveExistingFile(request.params.id, response);

    if (!resolved) {
      return;
    }

    await sendResolvedFile(request, response, resolved);
  });

  app.get("/api/events", (request, response) => {
    response.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    });
    response.flushHeaders?.();
    response.write(": connected\n\n");
    events.addClient(response);

    response.on("close", () => {
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

  app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const isAbortedUpload =
      (request.aborted || request.destroyed) &&
      error instanceof Error &&
      (error.message === "Request aborted" || error.name === "AbortError");

    if (isAbortedUpload) {
      if (!response.headersSent) {
        response.status(499).end();
      }
      return;
    }

    console.error(error);
    response.status(500).json({ message: "Errore interno del server." });
  });

  return {
    app,
    store,
    sync,
    urls,
    close() {
      clearInterval(keepAliveInterval);
      runtimeStats.dispose();
    }
  };
}
