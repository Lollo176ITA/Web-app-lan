export type LibraryKind =
  | "folder"
  | "video"
  | "image"
  | "audio"
  | "document"
  | "archive"
  | "other";

export type LibraryLayoutMode = "minimal" | "compact";
export type ArchiveFormat = "zip" | "7z" | "rar";

export interface LibraryItem {
  id: string;
  name: string;
  storedName: string;
  mimeType: string;
  kind: LibraryKind;
  sizeBytes: number;
  createdAt: string;
  parentId: string | null;
  childrenCount?: number;
  durationSeconds?: number;
  downloadUrl?: string;
  contentUrl?: string;
  streamUrl?: string;
}

export interface CreateFolderRequest {
  name: string;
  parentId?: string | null;
}

export interface CreateFolderResponse {
  item: LibraryItem;
}

export interface CreateArchiveRequest {
  format: ArchiveFormat;
}

export interface CreateArchiveResponse {
  item: LibraryItem;
}

export interface DeleteItemResponse {
  deletedIds: string[];
}

export type ItemPreview =
  | {
      mode: "text";
      text: string;
      truncated: boolean;
      source: "text" | "word";
    }
  | {
      mode: "pdf";
      url: string;
    }
  | {
      mode: "folder";
      childCount: number;
    }
  | {
      mode: "none";
      notice: string;
    };

export interface SessionInfo {
  appName: string;
  hostName: string;
  lanUrl: string;
  storagePath: string;
  itemCount: number;
  totalBytes: number;
  availableArchiveFormats: ArchiveFormat[];
}

export interface UploadResponse {
  items: LibraryItem[];
}
