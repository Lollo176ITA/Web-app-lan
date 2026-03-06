import { promises as fs } from "node:fs";
import path from "node:path";
import { lookup as lookupMimeType } from "mime-types";
import type { LibraryItem, LibraryKind } from "../shared/types.js";

const MANIFEST_FILENAME = "index.json";
const STREAMABLE_KINDS = new Set<LibraryKind>(["video", "audio"]);

function sanitizeFilename(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return normalized.slice(0, 80) || "file";
}

function normalizeMimeType(mimeType: string, originalName: string) {
  const fallbackMimeType = lookupMimeType(originalName) || "application/octet-stream";
  return !mimeType || mimeType === "application/octet-stream" ? fallbackMimeType : mimeType;
}

export function classifyMimeType(mimeType: string): LibraryKind {
  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("rar") ||
    mimeType.includes("7z")
  ) {
    return "archive";
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("pdf") ||
    mimeType.includes("json") ||
    mimeType.includes("word") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation")
  ) {
    return "document";
  }

  return "other";
}

function toItemUrls(id: string, kind: LibraryKind) {
  return {
    downloadUrl: `/api/items/${id}/download`,
    contentUrl: `/api/items/${id}/content`,
    streamUrl: STREAMABLE_KINDS.has(kind) ? `/api/items/${id}/stream` : undefined
  };
}

function sortItems(items: LibraryItem[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export class LibraryStore {
  readonly rootDir: string;
  readonly libraryDir: string;
  readonly manifestPath: string;
  private items: LibraryItem[] = [];

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
    this.libraryDir = path.join(this.rootDir, "library");
    this.manifestPath = path.join(this.rootDir, MANIFEST_FILENAME);
  }

  async init() {
    await fs.mkdir(this.libraryDir, { recursive: true });

    try {
      const manifest = await fs.readFile(this.manifestPath, "utf8");
      const rawItems = JSON.parse(manifest) as LibraryItem[];
      const existingItems: LibraryItem[] = [];

      for (const item of rawItems) {
        try {
          await fs.access(this.resolveItemPath(item));
          existingItems.push({
            ...item,
            ...toItemUrls(item.id, item.kind)
          });
        } catch {
          continue;
        }
      }

      this.items = sortItems(existingItems);
    } catch {
      this.items = [];
    }

    await this.persist();
  }

  buildStoredName(id: string, originalName: string) {
    return `${id}--${sanitizeFilename(originalName)}`;
  }

  getItems() {
    return sortItems(this.items);
  }

  findItem(id: string) {
    return this.items.find((item) => item.id === id);
  }

  getSummary() {
    return this.items.reduce(
      (summary, item) => ({
        itemCount: summary.itemCount + 1,
        totalBytes: summary.totalBytes + item.sizeBytes
      }),
      { itemCount: 0, totalBytes: 0 }
    );
  }

  resolveItemPath(item: Pick<LibraryItem, "storedName">) {
    const resolvedPath = path.resolve(this.libraryDir, item.storedName);
    const normalizedRoot = this.libraryDir.endsWith(path.sep)
      ? this.libraryDir
      : `${this.libraryDir}${path.sep}`;

    if (!resolvedPath.startsWith(normalizedRoot)) {
      throw new Error("Invalid storage path");
    }

    return resolvedPath;
  }

  async registerUploads(files: Express.Multer.File[]) {
    const createdAt = new Date().toISOString();
    const newItems = files.map((file) => {
      const id = file.filename.split("--")[0];
      const mimeType = normalizeMimeType(file.mimetype, file.originalname);
      const kind = classifyMimeType(mimeType);

      return {
        id,
        name: file.originalname,
        storedName: file.filename,
        mimeType,
        kind,
        sizeBytes: file.size,
        createdAt,
        ...toItemUrls(id, kind)
      } satisfies LibraryItem;
    });

    this.items = sortItems([...newItems, ...this.items]);
    await this.persist();

    return newItems;
  }

  private async persist() {
    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(this.items, null, 2), "utf8");
  }
}
