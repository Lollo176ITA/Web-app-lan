import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
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

async function createArchiveWithBsdtar(sourceRoot: string, sourceName: string, destinationPath: string) {
  await execFileAsync("bsdtar", ["-a", "-cf", destinationPath, "-C", sourceRoot, sourceName]);
}

async function createArchiveWithRar(sourceRoot: string, sourceName: string, destinationPath: string) {
  await execFileAsync("rar", ["a", "-idq", destinationPath, sourceName], {
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

      await createArchiveWithBsdtar(sourceRoot, "demo", destinationPath);
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

  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), `routeroom-stage-${format}-`));
  const rootEntry = entries[0];

  try {
    for (const entry of entries) {
      const destinationEntryPath = path.join(sourceRoot, ...entry.relativePath.split("/"));

      if (entry.kind === "folder") {
        await fs.mkdir(destinationEntryPath, { recursive: true });
        continue;
      }

      await fs.mkdir(path.dirname(destinationEntryPath), { recursive: true });

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

    await createArchiveWithBsdtar(sourceRoot, rootEntry.relativePath, destinationPath);
  } finally {
    await fs.rm(sourceRoot, { recursive: true, force: true });
  }
}
