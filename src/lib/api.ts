import type {
  ArchiveFormat,
  ChatSnapshotResponse,
  ClearGlobalChatResponse,
  ClientProfileResponse,
  CreateStreamRoomResponse,
  CreateArchiveResponse,
  CreateFolderResponse,
  DeleteStreamRoomResponse,
  DeleteItemResponse,
  DirectChatSnapshotResponse,
  HostDiagnosticsResponse,
  HostRuntimeStatsResponse,
  ItemPreview,
  LanIdentity,
  CreatePairingCodeResponse,
  LibraryItem,
  PlanSyncMappingRequest,
  PlanSyncMappingResponse,
  PostChatMessageRequest,
  PostRoomMessageRequest,
  RegisterSyncDeviceRequest,
  RegisterSyncDeviceResponse,
  SendChatMessageResponse,
  SendPrivateChatMessageResponse,
  SendRoomMessageResponse,
  SetStreamRoomVideoResponse,
  SessionInfo,
  SyncDeviceConfigResponse,
  SyncOverviewResponse,
  SyncUploadResponse,
  StreamRoomResponse,
  StreamRoomsResponse,
  UpdateSyncFoldersRequest,
  UpdateSyncFoldersResponse,
  UpdateStreamRoomPlaybackResponse,
  UploadResponse
} from "../../shared/types";

const uploadTargetBatchBytes = 24 * 1024 * 1024;
const uploadLargeFileThresholdBytes = 16 * 1024 * 1024;
const uploadMaxBatchSize = 60;
const uploadBatchConcurrency = 3;

interface UploadEntry {
  file: File;
  relativePath: string;
}

interface UploadBatch {
  entries: UploadEntry[];
  batchBytes: number;
}

export interface UploadProgress {
  totalFiles: number;
  completedFiles: number;
  uploadedBytes: number;
  totalBytes: number;
  currentBatchFiles: number;
  pendingFiles: number;
  percentage: number;
}

interface UploadFilesOptions {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

export interface AndroidAppReleaseInfo {
  assetName: string;
  downloadUrl: string;
  version: string;
  workflowRunUrl?: string | null;
}

const androidUpdateBaseUrl = "https://raw.githubusercontent.com/Lollo176ITA/Web-app-lan/builds/android-release/latest";

function createAbortError() {
  const error = new Error("Upload aborted");
  error.name = "AbortError";
  return error;
}

async function readJson<T>(resource: string, init?: RequestInit) {
  const response = await fetch(resource, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeUploadRelativePath(relativePath: string, fallbackName: string) {
  const pathSegments = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return pathSegments.join("/") || fallbackName;
}

function buildUploadEntries(files: File[]): UploadEntry[] {
  const entries = files.map((file) => ({
    file,
    pathSegments: normalizeUploadRelativePath(file.webkitRelativePath || file.name, file.name).split("/")
  }));
  const sharedRootFolder =
    entries.length > 0 &&
    entries.every((entry) => entry.pathSegments.length > 1 && entry.pathSegments[0] === entries[0]?.pathSegments[0])
      ? entries[0]?.pathSegments[0] ?? null
      : null;

  return entries.map((entry) => {
    const relativePath = sharedRootFolder ? entry.pathSegments.slice(1).join("/") : entry.pathSegments.join("/");

    return {
      file: entry.file,
      relativePath: relativePath || entry.file.name
    };
  });
}

function getUploadEntrySize(file: File) {
  return Math.max(file.size, 1);
}

// Keep large payloads isolated while still collapsing many tiny files into fewer requests.
function takeAdaptiveUploadBatch(entries: UploadEntry[], startIndex: number) {
  const batch: UploadEntry[] = [];
  let totalBytes = 0;

  for (let index = startIndex; index < entries.length; index += 1) {
    const entry = entries[index];
    const entryBytes = getUploadEntrySize(entry.file);

    if (batch.length === 0) {
      batch.push(entry);
      totalBytes += entryBytes;

      if (entryBytes >= uploadLargeFileThresholdBytes) {
        break;
      }

      continue;
    }

    if (entryBytes >= uploadLargeFileThresholdBytes) {
      break;
    }

    if (batch.length >= uploadMaxBatchSize || totalBytes + entryBytes > uploadTargetBatchBytes) {
      break;
    }

    batch.push(entry);
    totalBytes += entryBytes;
  }

  return batch;
}

function buildUploadBatches(entries: UploadEntry[]) {
  const batches: UploadBatch[] = [];

  for (let index = 0; index < entries.length;) {
    const batchEntries = takeAdaptiveUploadBatch(entries, index);
    batches.push({
      entries: batchEntries,
      batchBytes: batchEntries.reduce((total, entry) => total + getUploadEntrySize(entry.file), 0)
    });
    index += batchEntries.length;
  }

  return batches;
}

async function uploadFileBatch(
  entries: UploadEntry[],
  parentId?: string | null,
  onBatchProgress?: (loadedBytes: number) => void,
  signal?: AbortSignal
) {
  const body = new FormData();
  const batchBytes = entries.reduce((total, entry) => total + getUploadEntrySize(entry.file), 0);

  entries.forEach((entry) => {
    body.append("files", entry.file);
    body.append("relativePaths", entry.relativePath);
  });

  if (parentId !== null && parentId !== undefined) {
    body.append("parentId", parentId);
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  if (onBatchProgress && typeof XMLHttpRequest !== "undefined") {
    return new Promise<UploadResponse>((resolve, reject) => {
      const request = new XMLHttpRequest();
      let settled = false;

      const cleanupAbortListener = () => {
        signal?.removeEventListener("abort", handleAbort);
      };

      const rejectOnce = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanupAbortListener();
        reject(error);
      };

      const resolveOnce = (response: UploadResponse) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanupAbortListener();
        resolve(response);
      };

      const handleAbort = () => {
        request.abort();
        rejectOnce(createAbortError());
      };

      request.open("POST", "/api/items");
      request.responseType = "json";

      request.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onBatchProgress((batchBytes * event.loaded) / event.total);
          return;
        }

        onBatchProgress(Math.min(event.loaded, batchBytes));
      };

      request.onerror = () => {
        rejectOnce(new Error("Network error"));
      };

      request.onabort = () => {
        rejectOnce(createAbortError());
      };

      request.onload = () => {
        if (request.status < 200 || request.status >= 300) {
          rejectOnce(new Error(`Request failed: ${request.status}`));
          return;
        }

        const response =
          typeof request.response === "object" && request.response !== null
            ? (request.response as UploadResponse)
            : (JSON.parse(request.responseText) as UploadResponse);
        resolveOnce(response);
      };

      signal?.addEventListener("abort", handleAbort, { once: true });
      request.send(body);
    });
  }

  return readJson<UploadResponse>("/api/items", {
    method: "POST",
    body,
    signal
  });
}

export function fetchSession() {
  return readJson<SessionInfo>("/api/session");
}

export function fetchDiagnostics() {
  return readJson<HostDiagnosticsResponse>("/api/diagnostics");
}

export function fetchDiagnosticsRuntimeStats() {
  return readJson<HostRuntimeStatsResponse>("/api/diagnostics/stats");
}

export function fetchItems() {
  return readJson<LibraryItem[]>("/api/items");
}

export function fetchItem(itemId: string) {
  return readJson<LibraryItem>(`/api/items/${itemId}`);
}

export async function fetchSnapshot() {
  const [session, items] = await Promise.all([fetchSession(), fetchItems()]);
  return { session, items };
}

export function fetchChatSnapshot(viewerId?: string) {
  const params = viewerId ? `?${new URLSearchParams({ viewerId }).toString()}` : "";
  return readJson<ChatSnapshotResponse>(`/api/chat${params}`);
}

export function fetchClientProfile() {
  return readJson<ClientProfileResponse>("/api/me");
}

export function fetchSyncOverview() {
  return readJson<SyncOverviewResponse>("/api/sync/overview");
}

export async function fetchLatestAndroidAppRelease() {
  const response = await fetch(`${androidUpdateBaseUrl}/build-info.json`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const metadata = (await response.json()) as {
    files?: Array<{ name?: string }>;
    version?: string;
    workflowRunUrl?: string;
  };
  const version = metadata.version?.trim();
  const assetName = metadata.files?.find((file) => file.name?.trim().toLowerCase().endsWith(".apk"))?.name?.trim();

  if (!version || !assetName) {
    throw new Error("Invalid Android release metadata");
  }

  return {
    version,
    assetName,
    downloadUrl: `${androidUpdateBaseUrl}/${assetName}`,
    workflowRunUrl: metadata.workflowRunUrl?.trim() || null
  } satisfies AndroidAppReleaseInfo;
}

export function createSyncPairingCode() {
  return readJson<CreatePairingCodeResponse>("/api/sync/pairing-code", {
    method: "POST"
  });
}

export function revokeSyncDevice(deviceId: string) {
  return fetch(`/api/sync/devices/${encodeURIComponent(deviceId)}`, {
    method: "DELETE"
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
  });
}

export function registerSyncDevice(payload: RegisterSyncDeviceRequest, hostUrl = "") {
  return readJson<RegisterSyncDeviceResponse>(`${hostUrl}/api/sync/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export function fetchSyncDeviceConfig(authToken: string, hostUrl = "") {
  return readJson<SyncDeviceConfigResponse>(`${hostUrl}/api/sync/device/config`, {
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });
}

export function updateSyncDeviceConfig(payload: UpdateSyncFoldersRequest, authToken: string, hostUrl = "") {
  return readJson<UpdateSyncFoldersResponse>(`${hostUrl}/api/sync/device/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify(payload)
  });
}

export function planSyncMapping(mappingId: string, payload: PlanSyncMappingRequest, authToken: string, hostUrl = "") {
  return readJson<PlanSyncMappingResponse>(`${hostUrl}/api/sync/mappings/${encodeURIComponent(mappingId)}/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify(payload)
  });
}

export async function uploadSyncMapping(
  mappingId: string,
  files: File[],
  relativePaths: string[],
  modifiedAtMs: number[],
  authToken: string,
  hostUrl = ""
) {
  const body = new FormData();

  files.forEach((file, index) => {
    body.append("files", file);
    body.append("relativePaths", relativePaths[index] ?? file.name);
    body.append("modifiedAtMs", String(modifiedAtMs[index] ?? 0));
  });

  const response = await fetch(`${hostUrl}/api/sync/mappings/${encodeURIComponent(mappingId)}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as SyncUploadResponse;
}

export function sendChatMessage(identity: LanIdentity, text: string) {
  const body: PostChatMessageRequest = { identity, text };

  return readJson<SendChatMessageResponse>("/api/chat/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export function clearGlobalChat() {
  return readJson<ClearGlobalChatResponse>("/api/chat/messages", {
    method: "DELETE"
  });
}

export function fetchDirectChatSnapshot(userId: string, viewerId: string) {
  const params = new URLSearchParams({ viewerId });
  return readJson<DirectChatSnapshotResponse>(`/api/chat/users/${encodeURIComponent(userId)}?${params.toString()}`);
}

export function sendDirectChatMessage(userId: string, identity: LanIdentity, text: string) {
  const body: PostChatMessageRequest = { identity, text };

  return readJson<SendPrivateChatMessageResponse>(`/api/chat/users/${encodeURIComponent(userId)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export function fetchStreamRooms() {
  return readJson<StreamRoomsResponse>("/api/stream/rooms");
}

export function createStreamRoom(name: string) {
  return readJson<CreateStreamRoomResponse>("/api/stream/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  });
}

export function fetchStreamRoom(roomId: string) {
  return readJson<StreamRoomResponse>(`/api/stream/rooms/${roomId}`);
}

export function deleteStreamRoom(roomId: string) {
  return readJson<DeleteStreamRoomResponse>(`/api/stream/rooms/${roomId}`, {
    method: "DELETE"
  });
}

export function sendRoomMessage(roomId: string, identity: LanIdentity, text: string) {
  const body: PostRoomMessageRequest = { identity, text };

  return readJson<SendRoomMessageResponse>(`/api/stream/rooms/${roomId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export function setStreamRoomVideo(roomId: string, videoItemId: string) {
  return readJson<SetStreamRoomVideoResponse>(`/api/stream/rooms/${roomId}/video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ videoItemId })
  });
}

export function updateStreamRoomPlayback(
  roomId: string,
  action: "play" | "pause" | "seek",
  positionSeconds: number
) {
  return readJson<UpdateStreamRoomPlaybackResponse>(`/api/stream/rooms/${roomId}/playback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action, positionSeconds })
  });
}

export async function uploadFiles(files: File[], parentId?: string | null, options: UploadFilesOptions = {}) {
  if (files.length === 0) {
    return { items: [] } satisfies UploadResponse;
  }

  const uploadEntries = buildUploadEntries(files);
  const totalFiles = uploadEntries.length;
  const totalBytes = uploadEntries.reduce((total, entry) => total + getUploadEntrySize(entry.file), 0);
  const batches = buildUploadBatches(uploadEntries);
  const batchItems = Array.from({ length: batches.length }, () => [] as UploadResponse["items"]);
  const batchLoadedBytes = new Array<number>(batches.length).fill(0);
  const batchStarted = new Array<boolean>(batches.length).fill(false);
  const batchCompleted = new Array<boolean>(batches.length).fill(false);
  const abortController = new AbortController();
  const handleAbort = () => {
    abortController.abort();
  };
  let nextBatchIndex = 0;
  let firstError: Error | null = null;

  const emitProgress = () => {
    let completedFiles = 0;
    let uploadedBytes = 0;
    let currentBatchFiles = 0;

    batches.forEach((batch, index) => {
      if (batchCompleted[index]) {
        completedFiles += batch.entries.length;
        uploadedBytes += batch.batchBytes;
        return;
      }

      if (batchStarted[index]) {
        currentBatchFiles += batch.entries.length;
        uploadedBytes += Math.min(batchLoadedBytes[index] ?? 0, batch.batchBytes);
      }
    });

    options.onProgress?.({
      totalFiles,
      completedFiles,
      uploadedBytes: Math.min(uploadedBytes, totalBytes),
      totalBytes,
      currentBatchFiles,
      pendingFiles: Math.max(totalFiles - completedFiles - currentBatchFiles, 0),
      percentage: totalBytes > 0 ? Math.min((uploadedBytes / totalBytes) * 100, 100) : 100
    });
  };

  const assignUploadError = (error: unknown) => {
    if (firstError) {
      return;
    }

    firstError = error instanceof Error ? error : new Error("Upload failed");
  };

  const runWorker = async () => {
    while (true) {
      if (abortController.signal.aborted) {
        return;
      }

      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;

      if (batchIndex >= batches.length) {
        return;
      }

      const batch = batches[batchIndex]!;

      batchStarted[batchIndex] = true;
      emitProgress();

      try {
        const response = await uploadFileBatch(
          batch.entries,
          parentId,
          options.onProgress
            ? (loadedBatchBytes) => {
                batchLoadedBytes[batchIndex] = loadedBatchBytes;
                emitProgress();
              }
            : undefined,
          abortController.signal
        );
        batchItems[batchIndex] = response.items;
        batchLoadedBytes[batchIndex] = batch.batchBytes;
        batchCompleted[batchIndex] = true;
        emitProgress();
      } catch (error) {
        assignUploadError(error);
        abortController.abort();
        return;
      }
    }
  };

  emitProgress();

  if (options.signal?.aborted) {
    throw createAbortError();
  }

  options.signal?.addEventListener("abort", handleAbort, { once: true });

  try {
    await Promise.allSettled(
      Array.from({ length: Math.min(uploadBatchConcurrency, batches.length) }, () => runWorker())
    );

    if (firstError) {
      throw firstError;
    }

    if (options.signal?.aborted) {
      throw createAbortError();
    }

    return { items: batchItems.flat() } satisfies UploadResponse;
  } finally {
    options.signal?.removeEventListener("abort", handleAbort);
  }
}

export function createArchive(itemId: string, format: ArchiveFormat) {
  return readJson<CreateArchiveResponse>(`/api/items/${itemId}/archive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ format })
  });
}

export function createFolder(name: string, parentId?: string | null) {
  return readJson<CreateFolderResponse>("/api/folders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, parentId })
  });
}

export function deleteItem(itemId: string) {
  return readJson<DeleteItemResponse>(`/api/items/${itemId}`, {
    method: "DELETE"
  });
}

export function fetchItemPreview(itemId: string) {
  return readJson<ItemPreview>(`/api/items/${itemId}/preview`);
}

export function openLanEvents(
  handlers: Record<string, () => void>,
  onFallback: () => void,
  onOpen?: () => void
) {
  const source = new EventSource("/api/events");

  Object.entries(handlers).forEach(([eventName, handler]) => {
    source.addEventListener(eventName, handler);
  });

  source.onopen = () => {
    onOpen?.();
  };
  source.onerror = () => {
    source.close();
    onFallback();
  };

  return source;
}

export function openLibraryEvents(
  onUpdate: () => void,
  onFallback: () => void,
  onOpen?: () => void
) {
  return openLanEvents(
    {
      "library-updated": onUpdate
    },
    onFallback,
    onOpen
  );
}

export function openSyncEvents(
  onUpdate: () => void,
  onFallback: () => void,
  onOpen?: () => void
) {
  return openLanEvents(
    {
      "sync-updated": onUpdate
    },
    onFallback,
    onOpen
  );
}
