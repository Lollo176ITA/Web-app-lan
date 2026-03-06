import type {
  CreateFolderResponse,
  DeleteItemResponse,
  ItemPreview,
  LibraryItem,
  SessionInfo,
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

export function fetchItems() {
  return readJson<LibraryItem[]>("/api/items");
}

export async function fetchSnapshot() {
  const [session, items] = await Promise.all([fetchSession(), fetchItems()]);
  return { session, items };
}

export async function uploadFiles(files: File[], parentId?: string | null) {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  if (parentId) {
    body.append("parentId", parentId);
  }

  return readJson<UploadResponse>("/api/items", {
    method: "POST",
    body
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

export function openLibraryEvents(
  onUpdate: () => void,
  onFallback: () => void,
  onOpen?: () => void
) {
  const source = new EventSource("/api/events");

  source.addEventListener("library-updated", onUpdate);
  source.onopen = () => {
    onOpen?.();
  };
  source.onerror = () => {
    source.close();
    onFallback();
  };

  return source;
}
