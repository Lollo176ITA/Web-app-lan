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
  ItemPreview,
  LanIdentity,
  LibraryItem,
  PostChatMessageRequest,
  PostRoomMessageRequest,
  SendChatMessageResponse,
  SendPrivateChatMessageResponse,
  SendRoomMessageResponse,
  SetStreamRoomVideoResponse,
  SessionInfo,
  StreamRoomResponse,
  StreamRoomsResponse,
  UpdateStreamRoomPlaybackResponse,
  UploadResponse
} from "../../shared/types";

const uploadBatchSize = 20;

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

function buildUploadEntries(files: File[]) {
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

async function uploadFileBatch(
  entries: Array<{ file: File; relativePath: string }>,
  parentId?: string | null
) {
  const body = new FormData();

  entries.forEach((entry) => {
    body.append("files", entry.file);
    body.append("relativePaths", entry.relativePath);
  });

  if (parentId !== null && parentId !== undefined) {
    body.append("parentId", parentId);
  }

  return readJson<UploadResponse>("/api/items", {
    method: "POST",
    body
  });
}

export function fetchSession() {
  return readJson<SessionInfo>("/api/session");
}

export function fetchDiagnostics() {
  return readJson<HostDiagnosticsResponse>("/api/diagnostics");
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

export async function uploadFiles(files: File[], parentId?: string | null) {
  if (files.length === 0) {
    return { items: [] } satisfies UploadResponse;
  }

  const uploadEntries = buildUploadEntries(files);
  const items: UploadResponse["items"] = [];

  for (let index = 0; index < uploadEntries.length; index += uploadBatchSize) {
    const response = await uploadFileBatch(uploadEntries.slice(index, index + uploadBatchSize), parentId);
    items.push(...response.items);
  }

  return { items } satisfies UploadResponse;
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
