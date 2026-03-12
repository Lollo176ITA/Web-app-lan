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

async function readJson<T>(resource: string, init?: RequestInit) {
  const response = await fetch(resource, init);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
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
  const body = new FormData();
  files.forEach((file) => {
    body.append("files", file);
    body.append("relativePaths", file.webkitRelativePath || file.name);
  });
  if (parentId) {
    body.append("parentId", parentId);
  }

  return readJson<UploadResponse>("/api/items", {
    method: "POST",
    body
  });
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
