import { app, dialog, shell } from "electron";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const githubOwner = "Lollo176ITA";
const githubRepo = "Web-app-lan";
const rawGithubBaseUrl = `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}`;

function normalizeVersion(version) {
  return version.trim().replace(/^[^\d]*/, "");
}

function compareVersions(left, right) {
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

function getDesktopBuildBranch() {
  if (process.platform === "win32") {
    if (process.arch === "x64") {
      return "builds/win-x64";
    }

    if (process.arch === "arm64") {
      return "builds/win-arm64";
    }

    return null;
  }

  if (process.platform === "darwin") {
    return process.arch === "arm64" ? "builds/mac-arm64" : null;
  }

  if (process.platform === "linux") {
    return process.arch === "x64" ? "builds/linux-x64" : null;
  }

  return null;
}

function getPreferredAssetExtension() {
  if (process.platform === "win32") {
    return ".exe";
  }

  if (process.platform === "darwin") {
    return ".dmg";
  }

  if (process.platform === "linux") {
    return ".AppImage";
  }

  return null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `Routy/${app.getVersion()}`
    }
  });

  if (!response.ok) {
    throw new Error(`Update metadata request failed: ${response.status}`);
  }

  return response.json();
}

async function downloadUrlToFile(url, destinationPath, append = false) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": `Routy/${app.getVersion()}`
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`Update download failed: ${response.status}`);
  }

  await pipeline(
    Readable.fromWeb(response.body),
    createWriteStream(destinationPath, {
      flags: append ? "a" : "w"
    })
  );
}

async function resolveDesktopUpdate() {
  const branch = getDesktopBuildBranch();
  const preferredExtension = getPreferredAssetExtension();

  if (!branch || !preferredExtension) {
    return null;
  }

  const buildInfo = await fetchJson(`${rawGithubBaseUrl}/${branch}/latest/build-info.json`);
  const availableVersion = typeof buildInfo.version === "string" ? buildInfo.version.trim() : "";

  if (!availableVersion || compareVersions(availableVersion, app.getVersion()) <= 0) {
    return null;
  }

  const files = Array.isArray(buildInfo.files) ? buildInfo.files : [];
  const asset = files.find((entry) => typeof entry?.name === "string" && entry.name.endsWith(preferredExtension));

  if (!asset) {
    return null;
  }

  return {
    branch,
    version: availableVersion,
    workflowRunUrl: typeof buildInfo.workflowRunUrl === "string" ? buildInfo.workflowRunUrl : null,
    asset
  };
}

async function downloadDesktopUpdateAsset(update) {
  const assetName = typeof update.asset.originalName === "string" ? path.basename(update.asset.originalName) : path.basename(update.asset.name);
  const updateDirectory = path.join(app.getPath("temp"), "routy-updates", update.version);

  await fs.mkdir(updateDirectory, { recursive: true });

  const destinationPath = path.join(updateDirectory, assetName);
  await fs.rm(destinationPath, { force: true });

  if (update.asset.split && Array.isArray(update.asset.parts) && update.asset.parts.length > 0) {
    for (const [index, part] of update.asset.parts.entries()) {
      const partUrl = `${rawGithubBaseUrl}/${update.branch}/latest/${part.name}`;
      await downloadUrlToFile(partUrl, destinationPath, index > 0);
    }

    return destinationPath;
  }

  await downloadUrlToFile(`${rawGithubBaseUrl}/${update.branch}/latest/${update.asset.name}`, destinationPath);
  return destinationPath;
}

export async function maybePromptForDesktopUpdate(parentWindow) {
  if (!app.isPackaged) {
    return;
  }

  let update;

  try {
    update = await resolveDesktopUpdate();
  } catch {
    return;
  }

  if (!update) {
    return;
  }

  const result = await dialog.showMessageBox(parentWindow ?? undefined, {
    type: "info",
    title: "Aggiornamento disponibile",
    buttons: ["Aggiorna ora", "Più tardi"],
    defaultId: 0,
    cancelId: 1,
    message: `È disponibile Routy ${update.version}.`,
    detail: `Versione attuale: ${app.getVersion()}\nScarico e apro il pacchetto di aggiornamento per questo dispositivo.`
  });

  if (result.response !== 0) {
    return;
  }

  try {
    const downloadedPath = await downloadDesktopUpdateAsset(update);
    const openError = await shell.openPath(downloadedPath);

    if (openError) {
      throw new Error(openError);
    }

    const detailLines = [
      `Pacchetto pronto: ${downloadedPath}`
    ];

    if (update.workflowRunUrl) {
      detailLines.push(`Build: ${update.workflowRunUrl}`);
    }

    await dialog.showMessageBox(parentWindow ?? undefined, {
      type: "info",
      title: "Aggiornamento scaricato",
      message: "Ho aperto il pacchetto di aggiornamento.",
      detail: detailLines.join("\n")
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    await dialog.showMessageBox(parentWindow ?? undefined, {
      type: "error",
      title: "Aggiornamento non riuscito",
      message: "Non sono riuscito a scaricare o aprire l'aggiornamento desktop.",
      detail
    });
  }
}
