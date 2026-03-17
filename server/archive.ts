import archiver from "archiver";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";
import { promisify } from "node:util";
import type { ArchiveFormat } from "../shared/types.js";
import type { LibraryStore } from "./storage.js";

const execFileAsync = promisify(execFile);

const archiveMimeTypes: Record<ArchiveFormat, string> = {
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar"
};

async function commandExists(command: string) {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function createArchiveWithBsdtar(
  sourceRoot: string,
  sourceName: string,
  destinationPath: string,
  format: "zip" | "7z"
) {
  const baseArguments = ["-a", "-cf", destinationPath, "-C", sourceRoot, sourceName];

  if (format !== "zip") {
    await execFileAsync("bsdtar", baseArguments);
    return;
  }

  try {
    await execFileAsync("bsdtar", ["--options", "zip:compression=store", ...baseArguments]);
  } catch {
    // Fall back when host bsdtar does not support zip-specific options.
    await execFileAsync("bsdtar", baseArguments);
  }
}

async function createArchiveWithRar(sourceRoot: string, sourceName: string, destinationPath: string) {
  await execFileAsync("rar", ["a", "-idq", "-m0", destinationPath, sourceName], {
    cwd: sourceRoot
  });
}

async function probeFormat(format: ArchiveFormat) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `routeroom-probe-${format}-`));
  const sourceRoot = path.join(root, "source");
  const sourceDir = path.join(sourceRoot, "demo");
  const destinationPath = path.join(root, `probe.${format}`);

  try {
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, "ping.txt"), "routeroom");

    if (format === "rar") {
      if (!(await commandExists("rar"))) {
        return false;
      }

      await createArchiveWithRar(sourceRoot, "demo", destinationPath);
    } else {
      if (!(await commandExists("bsdtar"))) {
        return false;
      }

      await createArchiveWithBsdtar(sourceRoot, "demo", destinationPath, format);
    }

    await fs.access(destinationPath);
    return true;
  } catch {
    return false;
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

export async function detectAvailableArchiveFormats() {
  const supported: ArchiveFormat[] = [];

  for (const format of ["zip", "7z", "rar"] as const) {
    if (await probeFormat(format)) {
      supported.push(format);
    }
  }

  return supported;
}

export function getArchiveMimeType(format: ArchiveFormat) {
  return archiveMimeTypes[format];
}

function destroyArchiveOutput(output: Writable, error: unknown) {
  if (output.destroyed) {
    return;
  }

  output.destroy(error instanceof Error ? error : new Error("Archive stream failed"));
}

export function streamFolderArchiveAsZip(
  store: LibraryStore,
  folderId: string,
  output: Writable
) {
  const entries = store.getFolderArchiveEntries(folderId);

  if (!entries) {
    throw new Error("Folder not found");
  }

  const archive = archiver("zip", {
    store: true,
    zlib: { level: 0 }
  });

  archive.on("warning", (error) => {
    if (error.code === "ENOENT") {
      return;
    }

    destroyArchiveOutput(output, error);
  });

  archive.on("error", (error) => {
    destroyArchiveOutput(output, error);
  });

  archive.pipe(output);

  for (const entry of entries) {
    if (entry.kind === "folder") {
      archive.append("", {
        name: `${entry.relativePath}/`
      });
      continue;
    }

    archive.file(entry.sourcePath!, {
      name: entry.relativePath
    });
  }

  void archive.finalize().catch(() => undefined);

  return archive;
}

export async function createFolderArchive(
  store: LibraryStore,
  folderId: string,
  format: ArchiveFormat,
  destinationPath: string
) {
  const entries = store.getFolderArchiveEntries(folderId);

  if (!entries) {
    throw new Error("Folder not found");
  }

  const sourceRoot = await fs.mkdtemp(path.join(store.rootDir, `.routeroom-stage-${format}-`));
  const rootEntry = entries[0];
  const createdDirectories = new Set<string>([sourceRoot]);

  async function ensureDirectory(directoryPath: string) {
    if (createdDirectories.has(directoryPath)) {
      return;
    }

    await fs.mkdir(directoryPath, { recursive: true });
    createdDirectories.add(directoryPath);
  }

  try {
    for (const entry of entries) {
      const destinationEntryPath = path.join(sourceRoot, ...entry.relativePath.split("/"));

      if (entry.kind === "folder") {
        await ensureDirectory(destinationEntryPath);
        continue;
      }

      await ensureDirectory(path.dirname(destinationEntryPath));

      try {
        await fs.link(entry.sourcePath!, destinationEntryPath);
      } catch {
        await fs.copyFile(entry.sourcePath!, destinationEntryPath);
      }
    }

    if (format === "rar") {
      await createArchiveWithRar(sourceRoot, rootEntry.relativePath, destinationPath);
      return;
    }

    await createArchiveWithBsdtar(sourceRoot, rootEntry.relativePath, destinationPath, format);
  } finally {
    await fs.rm(sourceRoot, { recursive: true, force: true });
  }
}
