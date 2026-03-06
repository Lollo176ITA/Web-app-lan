export type LibraryKind =
  | "video"
  | "image"
  | "audio"
  | "document"
  | "archive"
  | "other";

export interface LibraryItem {
  id: string;
  name: string;
  storedName: string;
  mimeType: string;
  kind: LibraryKind;
  sizeBytes: number;
  createdAt: string;
  durationSeconds?: number;
  downloadUrl: string;
  contentUrl?: string;
  streamUrl?: string;
}

export interface SessionInfo {
  appName: string;
  hostName: string;
  lanUrl: string;
  storagePath: string;
  itemCount: number;
  totalBytes: number;
}

export interface UploadResponse {
  items: LibraryItem[];
}
