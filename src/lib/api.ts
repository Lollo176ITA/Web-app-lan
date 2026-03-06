import type { LibraryItem, SessionInfo, UploadResponse } from "../../shared/types";

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

export async function uploadFiles(files: File[]) {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));

  return readJson<UploadResponse>("/api/items", {
    method: "POST",
    body
  });
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
