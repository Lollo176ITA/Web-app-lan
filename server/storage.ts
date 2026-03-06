import { promises as fs } from "node:fs";
import path from "node:path";
import { lookup as lookupMimeType } from "mime-types";
import { nanoid } from "nanoid";
import type { LibraryItem, LibraryKind } from "../shared/types.js";

const MANIFEST_FILENAME = "index.json";
const FOLDER_MIME_TYPE = "application/vnd.routeroom.folder";
const STREAMABLE_KINDS = new Set<LibraryKind>(["video", "audio"]);

type StoredLibraryItem = Omit<
  LibraryItem,
  "childrenCount" | "contentUrl" | "downloadUrl" | "streamUrl"
>;

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
    mimeType.includes("presentation") ||
    mimeType.includes("rtf")
  ) {
    return "document";
  }

  return "other";
}

function toItemUrls(id: string, kind: LibraryKind) {
  if (kind === "folder") {
    return {
      downloadUrl: undefined,
      contentUrl: undefined,
      streamUrl: undefined
    };
  }

  return {
    downloadUrl: `/api/items/${id}/download`,
    contentUrl: `/api/items/${id}/content`,
    streamUrl: STREAMABLE_KINDS.has(kind) ? `/api/items/${id}/stream` : undefined
  };
}

function sortItems(items: StoredLibraryItem[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export class LibraryStore {
  readonly rootDir: string;
  readonly libraryDir: string;
  readonly manifestPath: string;
  private items: StoredLibraryItem[] = [];

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
    this.libraryDir = path.join(this.rootDir, "library");
    this.manifestPath = path.join(this.rootDir, MANIFEST_FILENAME);
  }

  async init(options: { seedDemo?: boolean } = {}) {
    await fs.mkdir(this.libraryDir, { recursive: true });

    try {
      const manifest = await fs.readFile(this.manifestPath, "utf8");
      const rawItems = JSON.parse(manifest) as StoredLibraryItem[];
      const existingItems: StoredLibraryItem[] = [];

      for (const item of rawItems) {
        if (item.kind === "folder") {
          existingItems.push({
            ...item,
            parentId: item.parentId ?? null
          });
          continue;
        }

        try {
          await fs.access(this.resolveItemPath(item));
          existingItems.push({
            ...item,
            parentId: item.parentId ?? null
          });
        } catch {
          continue;
        }
      }

      this.items = sortItems(existingItems);
    } catch {
      this.items = [];
    }

    if (options.seedDemo && this.items.length === 0) {
      this.seedDemoContent();
    }

    await this.persist();
  }

  buildStoredName(id: string, originalName: string) {
    return `${id}--${sanitizeFilename(originalName)}`;
  }

  getItems() {
    return sortItems(this.items).map((item) => this.hydrateItem(item));
  }

  findItem(id: string) {
    const item = this.findItemRecord(id);
    return item ? this.hydrateItem(item) : undefined;
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

  resolveItemPath(item: Pick<StoredLibraryItem, "storedName">) {
    if (!item.storedName) {
      throw new Error("Folders do not resolve to a file path");
    }

    const resolvedPath = path.resolve(this.libraryDir, item.storedName);
    const normalizedRoot = this.libraryDir.endsWith(path.sep)
      ? this.libraryDir
      : `${this.libraryDir}${path.sep}`;

    if (!resolvedPath.startsWith(normalizedRoot)) {
      throw new Error("Invalid storage path");
    }

    return resolvedPath;
  }

  async registerUploads(files: Express.Multer.File[], parentId: string | null = null) {
    this.assertParentFolder(parentId);
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
        parentId
      } satisfies StoredLibraryItem;
    });

    this.items = sortItems([...newItems, ...this.items]);
    await this.persist();

    return newItems.map((item) => this.hydrateItem(item));
  }

  async registerUploadsWithPaths(
    files: Express.Multer.File[],
    relativePaths: string[],
    parentId: string | null = null
  ) {
    this.assertParentFolder(parentId);

    const createdAt = new Date().toISOString();
    const createdFolders: StoredLibraryItem[] = [];
    const newItems = files.map((file, index) => {
      const relativePath = relativePaths[index] || file.originalname;
      const normalizedRelativePath = relativePath.replace(/\\/g, "/");
      const pathSegments = normalizedRelativePath.split("/").filter(Boolean);
      const fileName = pathSegments.at(-1) ?? file.originalname;
      const targetParentId = this.ensureFolderChain(pathSegments.slice(0, -1), parentId, createdAt, createdFolders);
      const id = file.filename.split("--")[0];
      const mimeType = normalizeMimeType(file.mimetype, file.originalname);
      const kind = classifyMimeType(mimeType);

      return {
        id,
        name: fileName,
        storedName: file.filename,
        mimeType,
        kind,
        sizeBytes: file.size,
        createdAt,
        parentId: targetParentId
      } satisfies StoredLibraryItem;
    });

    this.items = sortItems([...createdFolders, ...newItems, ...this.items]);
    await this.persist();

    return newItems.map((item) => this.hydrateItem(item));
  }

  async createFolder(name: string, parentId: string | null = null) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("Folder name required");
    }

    this.assertParentFolder(parentId);

    const folder = {
      id: nanoid(10),
      name: trimmedName,
      storedName: "",
      mimeType: FOLDER_MIME_TYPE,
      kind: "folder",
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
      parentId
    } satisfies StoredLibraryItem;

    this.items = sortItems([folder, ...this.items]);
    await this.persist();

    return this.hydrateItem(folder);
  }

  async deleteItem(id: string) {
    const target = this.findItemRecord(id);

    if (!target) {
      return null;
    }

    const idsToDelete = new Set<string>([id]);

    if (target.kind === "folder") {
      let pending = true;

      while (pending) {
        pending = false;

        for (const item of this.items) {
          if (item.parentId && idsToDelete.has(item.parentId) && !idsToDelete.has(item.id)) {
            idsToDelete.add(item.id);
            pending = true;
          }
        }
      }
    }

    for (const item of this.items) {
      if (!idsToDelete.has(item.id) || item.kind === "folder") {
        continue;
      }

      try {
        await fs.rm(this.resolveItemPath(item), { force: true });
      } catch {
        continue;
      }
    }

    this.items = this.items.filter((item) => !idsToDelete.has(item.id));
    await this.persist();

    return [...idsToDelete];
  }

  private findItemRecord(id: string) {
    return this.items.find((item) => item.id === id);
  }

  private hydrateItem(item: StoredLibraryItem): LibraryItem {
    return {
      ...item,
      childrenCount:
        item.kind === "folder"
          ? this.items.filter((candidate) => candidate.parentId === item.id).length
          : undefined,
      ...toItemUrls(item.id, item.kind)
    };
  }

  private assertParentFolder(parentId: string | null) {
    if (!parentId) {
      return;
    }

    const parent = this.findItemRecord(parentId);

    if (!parent || parent.kind !== "folder") {
      throw new Error("Invalid parent folder");
    }
  }

  private ensureFolderChain(
    folderNames: string[],
    startingParentId: string | null,
    createdAt: string,
    createdFolders: StoredLibraryItem[]
  ) {
    let currentParentId = startingParentId;

    for (const rawName of folderNames) {
      const folderName = rawName.trim();

      if (!folderName) {
        continue;
      }

      const existingFolder = this.items.find(
        (item) =>
          item.kind === "folder" &&
          item.parentId === currentParentId &&
          item.name === folderName
      ) ?? createdFolders.find(
        (item) =>
          item.kind === "folder" &&
          item.parentId === currentParentId &&
          item.name === folderName
      );

      if (existingFolder) {
        currentParentId = existingFolder.id;
        continue;
      }

      const folder = {
        id: nanoid(10),
        name: folderName,
        storedName: "",
        mimeType: FOLDER_MIME_TYPE,
        kind: "folder",
        sizeBytes: 0,
        createdAt,
        parentId: currentParentId
      } satisfies StoredLibraryItem;

      createdFolders.push(folder);
      currentParentId = folder.id;
    }

    return currentParentId;
  }

  private seedDemoContent() {
    const rootFolderId = nanoid(10);

    this.items = sortItems([
      {
        id: nanoid(10),
        name: "Manuali",
        storedName: "",
        mimeType: FOLDER_MIME_TYPE,
        kind: "folder",
        sizeBytes: 0,
        createdAt: new Date().toISOString(),
        parentId: rootFolderId
      },
      {
        id: rootFolderId,
        name: "Esempio Routeroom",
        storedName: "",
        mimeType: FOLDER_MIME_TYPE,
        kind: "folder",
        sizeBytes: 0,
        createdAt: new Date().toISOString(),
        parentId: null
      }
    ]);
  }

  private async persist() {
    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(this.items, null, 2), "utf8");
  }
}
