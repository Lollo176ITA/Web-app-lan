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

export interface FolderArchiveEntry {
  kind: "folder" | "file";
  relativePath: string;
  sourcePath?: string;
}

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

function joinStoredPath(...segments: string[]) {
  return path.posix.join(...segments.filter(Boolean));
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
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
      const normalizedItems = rawItems.map((item) => ({
        ...item,
        parentId: item.parentId ?? null
      }));

      this.items = await this.materializeStorageLayout(normalizedItems);
    } catch {
      this.items = [];
    }

    if (options.seedDemo && this.items.length === 0) {
      this.seedDemoContent();
      this.items = this.computeDesiredStoredItems(this.items);
      await this.ensureFolderDirectories(this.items);
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

  getFolderArchiveEntries(folderId: string) {
    const folder = this.findItemRecord(folderId);

    if (!folder || folder.kind !== "folder") {
      return null;
    }

    const entries: FolderArchiveEntry[] = [
      {
        kind: "folder",
        relativePath: folder.name
      }
    ];

    const visit = (parentId: string, prefix: string) => {
      const children = [...this.items]
        .filter((item) => item.parentId === parentId)
        .sort((left, right) => left.name.localeCompare(right.name, "it", { sensitivity: "base" }));

      for (const child of children) {
        const relativePath = path.posix.join(prefix, child.name);

        if (child.kind === "folder") {
          entries.push({
            kind: "folder",
            relativePath
          });
          visit(child.id, relativePath);
          continue;
        }

        entries.push({
          kind: "file",
          relativePath,
          sourcePath: this.resolveItemPath(child)
        });
      }
    };

    visit(folder.id, folder.name);

    return entries;
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

    return this.resolveStoredPath(item.storedName);
  }

  async registerUploads(files: Express.Multer.File[], parentId: string | null = null) {
    this.assertParentFolder(parentId);

    const createdAt = new Date().toISOString();
    const parentStoredName = this.getParentStoredName(parentId);
    const newItems = files.map((file) => {
      const id = file.filename.split("--")[0];
      const mimeType = normalizeMimeType(file.mimetype, file.originalname);
      const kind = classifyMimeType(mimeType);

      return {
        id,
        name: file.originalname,
        storedName: this.buildFileStoredName(id, file.originalname, parentStoredName),
        mimeType,
        kind,
        sizeBytes: file.size,
        createdAt,
        parentId
      } satisfies StoredLibraryItem;
    });

    for (const [index, file] of files.entries()) {
      await this.placeUploadedFile(this.resolveUploadTempPath(file), newItems[index]!.storedName);
    }

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
        storedName: this.buildFileStoredName(id, fileName, this.getParentStoredName(targetParentId, createdFolders)),
        mimeType,
        kind,
        sizeBytes: file.size,
        createdAt,
        parentId: targetParentId
      } satisfies StoredLibraryItem;
    });

    await this.ensureFolderDirectories(createdFolders);

    for (const [index, file] of files.entries()) {
      await this.placeUploadedFile(this.resolveUploadTempPath(file), newItems[index]!.storedName);
    }

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

    const nextFolder = {
      id: nanoid(10),
      name: trimmedName,
      storedName: "",
      mimeType: FOLDER_MIME_TYPE,
      kind: "folder",
      sizeBytes: 0,
      createdAt: new Date().toISOString(),
      parentId
    } satisfies StoredLibraryItem;

    nextFolder.storedName = this.buildFolderStoredName(nextFolder.id, parentId);
    await fs.mkdir(this.resolveStoredPath(nextFolder.storedName), { recursive: true });

    this.items = sortItems([nextFolder, ...this.items]);
    await this.persist();

    return this.hydrateItem(nextFolder);
  }

  async ensureFolderPath(folderNames: string[], parentId: string | null = null) {
    this.assertParentFolder(parentId);

    let currentParentId = parentId;
    let currentFolder =
      currentParentId && this.findItemRecord(currentParentId)?.kind === "folder"
        ? this.findItem(currentParentId) ?? null
        : null;
    const createdAt = new Date().toISOString();
    const createdFolders: StoredLibraryItem[] = [];

    for (const rawName of folderNames) {
      const folderName = rawName.trim();

      if (!folderName) {
        continue;
      }

      const existingItem = this.findChildItemRecordByName(currentParentId, folderName, createdFolders);

      if (existingItem) {
        if (existingItem.kind !== "folder") {
          throw new Error("Conflicting file entry");
        }

        currentParentId = existingItem.id;
        currentFolder = this.hydrateItem(existingItem);
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

      folder.storedName = this.buildFolderStoredName(folder.id, currentParentId, createdFolders);
      createdFolders.push(folder);
      currentParentId = folder.id;
      currentFolder = this.hydrateItem(folder);
    }

    if (createdFolders.length > 0) {
      await this.ensureFolderDirectories(createdFolders);
      this.items = sortItems([...createdFolders, ...this.items]);
      await this.persist();
    }

    return currentFolder;
  }

  async registerGeneratedFile(
    sourcePath: string,
    originalName: string,
    mimeType: string,
    parentId: string | null = null
  ) {
    this.assertParentFolder(parentId);

    const id = nanoid(10);
    const storedName = this.buildFileStoredName(id, originalName, this.getParentStoredName(parentId));
    const destinationPath = this.resolveStoredPath(storedName);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
    const fileStats = await fs.stat(destinationPath);
    const normalizedMimeType = normalizeMimeType(mimeType, originalName);

    const item = {
      id,
      name: originalName,
      storedName,
      mimeType: normalizedMimeType,
      kind: classifyMimeType(normalizedMimeType),
      sizeBytes: fileStats.size,
      createdAt: new Date().toISOString(),
      parentId
    } satisfies StoredLibraryItem;

    this.items = sortItems([item, ...this.items]);
    await this.persist();

    return this.hydrateItem(item);
  }

  findChildItemByName(parentId: string | null, name: string) {
    const item = this.findChildItemRecordByName(parentId, name);
    return item ? this.hydrateItem(item) : undefined;
  }

  async upsertFileFromPath(
    sourcePath: string,
    originalName: string,
    mimeType: string,
    parentId: string | null = null
  ) {
    this.assertParentFolder(parentId);

    const conflictingFolder = this.items.find(
      (item) => item.parentId === parentId && item.name === originalName && item.kind === "folder"
    );

    if (conflictingFolder) {
      throw new Error("Conflicting folder entry");
    }

    const existingItem = this.items.find(
      (item) => item.parentId === parentId && item.name === originalName && item.kind !== "folder"
    );
    const fileStats = await fs.stat(sourcePath);
    const normalizedMimeType = normalizeMimeType(mimeType, originalName);
    const createdAt = new Date().toISOString();

    if (existingItem) {
      await fs.mkdir(path.dirname(this.resolveItemPath(existingItem)), { recursive: true });
      await fs.copyFile(sourcePath, this.resolveItemPath(existingItem));

      const nextItem = {
        ...existingItem,
        mimeType: normalizedMimeType,
        kind: classifyMimeType(normalizedMimeType),
        sizeBytes: fileStats.size,
        createdAt
      } satisfies StoredLibraryItem;

      this.items = sortItems([nextItem, ...this.items.filter((item) => item.id !== existingItem.id)]);
      await this.persist();

      return {
        status: "updated" as const,
        item: this.hydrateItem(nextItem)
      };
    }

    const id = nanoid(10);
    const storedName = this.buildFileStoredName(id, originalName, this.getParentStoredName(parentId));
    const destinationPath = this.resolveStoredPath(storedName);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);

    const item = {
      id,
      name: originalName,
      storedName,
      mimeType: normalizedMimeType,
      kind: classifyMimeType(normalizedMimeType),
      sizeBytes: fileStats.size,
      createdAt,
      parentId
    } satisfies StoredLibraryItem;

    this.items = sortItems([item, ...this.items]);
    await this.persist();

    return {
      status: "created" as const,
      item: this.hydrateItem(item)
    };
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

      await fs.rm(this.resolveStoredPath(target.storedName), {
        recursive: true,
        force: true
      });
    } else {
      await fs.rm(this.resolveItemPath(target), { force: true });
    }

    this.items = this.items.filter((item) => !idsToDelete.has(item.id));
    await this.persist();

    return [...idsToDelete];
  }

  private findItemRecord(id: string) {
    return this.items.find((item) => item.id === id);
  }

  private findChildItemRecordByName(
    parentId: string | null,
    name: string,
    createdFolders: StoredLibraryItem[] = []
  ) {
    return (
      this.items.find((item) => item.parentId === parentId && item.name === name) ??
      createdFolders.find((item) => item.parentId === parentId && item.name === name)
    );
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

      const existingFolder = this.findFolderByName(folderName, currentParentId, createdFolders);

      if (existingFolder) {
        currentParentId = existingFolder.id;
        continue;
      }

      const folderId = nanoid(10);
      const folder = {
        id: folderId,
        name: folderName,
        storedName: this.buildFolderStoredName(folderId, currentParentId, createdFolders),
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

  private findFolderByName(
    folderName: string,
    parentId: string | null,
    createdFolders: StoredLibraryItem[] = []
  ) {
    return (
      this.items.find(
        (item) =>
          item.kind === "folder" &&
          item.parentId === parentId &&
          item.name === folderName
      ) ??
      createdFolders.find(
        (item) =>
          item.kind === "folder" &&
          item.parentId === parentId &&
          item.name === folderName
      )
    );
  }

  private getParentStoredName(parentId: string | null, createdFolders: StoredLibraryItem[] = []) {
    if (!parentId) {
      return "";
    }

    const parent =
      this.items.find((item) => item.id === parentId && item.kind === "folder") ??
      createdFolders.find((item) => item.id === parentId && item.kind === "folder");

    if (!parent) {
      return "";
    }

    return parent.storedName;
  }

  private buildFolderStoredName(
    folderId: string,
    parentId: string | null,
    createdFolders: StoredLibraryItem[] = []
  ) {
    const parentStoredName = this.getParentStoredName(parentId, createdFolders);
    return parentStoredName ? joinStoredPath(parentStoredName, folderId) : folderId;
  }

  private buildFileStoredName(id: string, originalName: string, parentStoredName: string) {
    const leafName = this.buildStoredName(id, originalName);
    return parentStoredName ? joinStoredPath(parentStoredName, leafName) : leafName;
  }

  private resolveStoredPath(storedName: string) {
    const resolvedPath = path.resolve(this.libraryDir, ...storedName.split("/").filter(Boolean));
    const normalizedRoot = this.libraryDir.endsWith(path.sep)
      ? this.libraryDir
      : `${this.libraryDir}${path.sep}`;

    if (resolvedPath !== this.libraryDir && !resolvedPath.startsWith(normalizedRoot)) {
      throw new Error("Invalid storage path");
    }

    return resolvedPath;
  }

  private resolveUploadTempPath(file: Express.Multer.File) {
    return "path" in file && typeof file.path === "string"
      ? file.path
      : path.resolve(this.libraryDir, file.filename);
  }

  private async placeUploadedFile(sourcePath: string, storedName: string) {
    const destinationPath = this.resolveStoredPath(storedName);

    if (sourcePath === destinationPath) {
      return;
    }

    await this.moveStorageEntry(sourcePath, destinationPath);
  }

  private async moveStorageEntry(sourcePath: string, destinationPath: string) {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });

    try {
      await fs.rename(sourcePath, destinationPath);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "";

      if (code !== "EXDEV") {
        throw error;
      }

      await fs.copyFile(sourcePath, destinationPath);
      await fs.rm(sourcePath, { force: true });
    }
  }

  private async materializeStorageLayout(items: StoredLibraryItem[]) {
    const rawItems = sortItems(items);
    const desiredItems = this.computeDesiredStoredItems(rawItems);
    const rawItemsById = new Map(rawItems.map((item) => [item.id, item]));
    const existingItems: StoredLibraryItem[] = [];

    await this.ensureFolderDirectories(desiredItems);

    for (const item of desiredItems) {
      if (item.kind === "folder") {
        existingItems.push(item);
        continue;
      }

      const rawItem = rawItemsById.get(item.id) ?? item;
      const desiredPath = this.resolveStoredPath(item.storedName);
      const currentPath = rawItem.storedName ? this.resolveStoredPath(rawItem.storedName) : null;
      const desiredExists = await pathExists(desiredPath);
      const currentExists = currentPath
        ? currentPath === desiredPath
          ? desiredExists
          : await pathExists(currentPath)
        : false;

      if (!desiredExists && currentPath && currentExists) {
        await this.moveStorageEntry(currentPath, desiredPath);
        existingItems.push(item);
        continue;
      }

      if (desiredExists) {
        if (currentPath && currentPath !== desiredPath && currentExists) {
          await fs.rm(currentPath, { force: true });
        }

        existingItems.push(item);
      }
    }

    return sortItems(existingItems);
  }

  private computeDesiredStoredItems(items: StoredLibraryItem[]) {
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const folderPathCache = new Map<string, string>();

    const resolveFolderStoredName = (folderId: string): string => {
      const cached = folderPathCache.get(folderId);

      if (cached) {
        return cached;
      }

      const folder = itemsById.get(folderId);

      if (!folder || folder.kind !== "folder") {
        return folderId;
      }

      const parent = folder.parentId ? itemsById.get(folder.parentId) : undefined;
      const parentStoredName =
        parent && parent.kind === "folder" ? resolveFolderStoredName(parent.id) : "";
      const storedName = parentStoredName ? joinStoredPath(parentStoredName, folder.id) : folder.id;

      folderPathCache.set(folderId, storedName);
      return storedName;
    };

    return items.map((item) => {
      if (item.kind === "folder") {
        return {
          ...item,
          storedName: resolveFolderStoredName(item.id)
        };
      }

      const parent = item.parentId ? itemsById.get(item.parentId) : undefined;
      const parentStoredName =
        parent && parent.kind === "folder" ? resolveFolderStoredName(parent.id) : "";

      return {
        ...item,
        storedName: this.buildFileStoredName(item.id, item.name, parentStoredName)
      };
    });
  }

  private async ensureFolderDirectories(items: StoredLibraryItem[]) {
    for (const item of items) {
      if (item.kind !== "folder") {
        continue;
      }

      await fs.mkdir(this.resolveStoredPath(item.storedName), { recursive: true });
    }
  }

  private seedDemoContent() {
    const rootFolderId = nanoid(10);
    const manualsFolderId = nanoid(10);
    const createdAt = new Date().toISOString();

    this.items = sortItems([
      {
        id: manualsFolderId,
        name: "Manuali",
        storedName: "",
        mimeType: FOLDER_MIME_TYPE,
        kind: "folder",
        sizeBytes: 0,
        createdAt,
        parentId: rootFolderId
      },
      {
        id: rootFolderId,
        name: "EsempioRouty",
        storedName: "",
        mimeType: FOLDER_MIME_TYPE,
        kind: "folder",
        sizeBytes: 0,
        createdAt,
        parentId: null
      }
    ]);
  }

  private async persist() {
    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(this.items, null, 2), "utf8");
  }
}
