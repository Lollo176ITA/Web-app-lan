export type WindowsDesktopBuildTarget = "win-x64" | "win-arm64";

interface BuildInfoPart {
  name?: string;
  size?: number;
}

interface BuildInfoFile {
  name?: string;
  originalName?: string;
  size?: number;
  split?: boolean;
  parts?: BuildInfoPart[];
}

interface BuildInfoMetadata {
  files?: BuildInfoFile[];
  version?: string;
  workflowRunUrl?: string;
}

export interface DesktopReleaseAssetPart {
  downloadUrl: string;
  name: string;
  sizeBytes: number;
}

export interface DesktopReleaseAsset {
  downloadUrl: string | null;
  name: string;
  originalName: string;
  parts: DesktopReleaseAssetPart[];
  sizeBytes: number;
  split: boolean;
}

export interface DesktopReleaseInfo {
  asset: DesktopReleaseAsset;
  target: WindowsDesktopBuildTarget;
  version: string;
  workflowRunUrl: string | null;
}

export const windowsDesktopBuildTargets: Record<
  WindowsDesktopBuildTarget,
  {
    branch: string;
    description: string;
    label: string;
  }
> = {
  "win-x64": {
    branch: "builds/win-x64",
    description: "PC Windows 64 bit.",
    label: "Windows x64"
  },
  "win-arm64": {
    branch: "builds/win-arm64",
    description: "PC Windows ARM64.",
    label: "Windows ARM64"
  }
};

const githubOwner = "Lollo176ITA";
const githubRepo = "Web-app-lan";
const githubRawBaseUrl = `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}`;

function normalizeVersion(version: string) {
  return version.trim().replace(/^[^\d]*/, "");
}

export function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue === rightValue) {
      continue;
    }

    return leftValue > rightValue ? 1 : -1;
  }

  return 0;
}

function buildRawUrl(branch: string, relativePath: string) {
  return `${githubRawBaseUrl}/${branch}/latest/${relativePath}`;
}

function resolveDesktopAsset(target: WindowsDesktopBuildTarget, metadata: BuildInfoMetadata) {
  const branch = windowsDesktopBuildTargets[target].branch;
  const asset = metadata.files?.find((entry) => entry.name?.trim().toLowerCase().endsWith(".exe"));

  if (!asset?.name || !metadata.version?.trim()) {
    throw new Error(`Metadata release non valida per ${target}`);
  }

  const originalName = asset.originalName?.trim() || asset.name.trim();

  return {
    asset: {
      downloadUrl: asset.split ? null : buildRawUrl(branch, asset.name),
      name: asset.name,
      originalName,
      parts:
        asset.split && Array.isArray(asset.parts)
          ? asset.parts
              .filter((part): part is Required<BuildInfoPart> => Boolean(part.name && Number.isFinite(part.size)))
              .map((part) => ({
                downloadUrl: buildRawUrl(branch, part.name),
                name: part.name,
                sizeBytes: part.size
              }))
          : [],
      sizeBytes: Number.isFinite(asset.size) ? asset.size : 0,
      split: Boolean(asset.split)
    },
    target,
    version: metadata.version.trim(),
    workflowRunUrl: metadata.workflowRunUrl?.trim() || null
  } satisfies DesktopReleaseInfo;
}

async function fetchBuildMetadata(target: WindowsDesktopBuildTarget) {
  const branch = windowsDesktopBuildTargets[target].branch;
  const response = await fetch(buildRawUrl(branch, "build-info.json"), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as BuildInfoMetadata;
}

async function readBinaryWithProgress(
  url: string,
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void
) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null;

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress?.(bytes.byteLength, contentLength ?? bytes.byteLength);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    chunks.push(value);
    totalLength += value.byteLength;
    onProgress?.(totalLength, contentLength);
  }

  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1_000);
}

async function downloadRemoteFile(
  url: string,
  filename: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
) {
  let knownTotalBytes = 0;

  const bytes = await readBinaryWithProgress(url, (loadedBytes, totalBytes) => {
    const effectiveTotalBytes = totalBytes ?? loadedBytes;
    knownTotalBytes = effectiveTotalBytes;
    onProgress?.(loadedBytes, effectiveTotalBytes);
  });
  triggerBrowserDownload(new Blob([bytes], { type: "application/octet-stream" }), filename);
  onProgress?.(bytes.byteLength, knownTotalBytes || bytes.byteLength);
}

export async function fetchLatestDesktopRelease(target: WindowsDesktopBuildTarget) {
  const metadata = await fetchBuildMetadata(target);
  return resolveDesktopAsset(target, metadata);
}

export async function downloadDesktopReleaseAsset(
  asset: DesktopReleaseAsset,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
) {
  const totalBytes = Math.max(
    asset.sizeBytes,
    asset.parts.reduce((sum, part) => sum + part.sizeBytes, 0)
  );
  const suggestedFilename = asset.originalName.split("/").pop() || asset.name.split("/").pop() || asset.name;

  if (!asset.split && asset.downloadUrl) {
    await downloadRemoteFile(asset.downloadUrl, suggestedFilename, onProgress);
    onProgress?.(totalBytes, totalBytes);
    return;
  }

  const assembledChunks: Uint8Array[] = [];
  let loadedBytes = 0;

  for (const part of asset.parts) {
    const partBytes = await readBinaryWithProgress(part.downloadUrl, (currentPartBytes) => {
      onProgress?.(Math.min(loadedBytes + currentPartBytes, totalBytes), totalBytes);
    });

    loadedBytes += partBytes.byteLength;
    assembledChunks.push(partBytes);
  }

  triggerBrowserDownload(new Blob(assembledChunks, { type: "application/octet-stream" }), suggestedFilename);
  onProgress?.(totalBytes, totalBytes);
}
