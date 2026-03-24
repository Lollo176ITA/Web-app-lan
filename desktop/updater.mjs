import { app, dialog } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

const updateCheckIntervalMs = 60 * 60 * 1000;

let updaterStarted = false;
let checkTimer = null;
let checkInFlight = false;
let resolveParentWindow = () => null;
let stopBeforeInstall = async () => {};
let notifiedAvailableVersion = null;
let promptedDownloadedVersion = null;

function supportsDesktopAutoUpdate() {
  return app.isPackaged && process.platform === "win32";
}

function getParentWindow() {
  try {
    return resolveParentWindow() ?? undefined;
  } catch {
    return undefined;
  }
}

async function maybePromptForDownloadedUpdate(version) {
  if (!version || promptedDownloadedVersion === version) {
    return;
  }

  promptedDownloadedVersion = version;

  const result = await dialog.showMessageBox(getParentWindow(), {
    type: "info",
    title: "Aggiornamento pronto",
    buttons: ["Riavvia e installa", "Più tardi"],
    defaultId: 0,
    cancelId: 1,
    message: `Routy ${version} è stato scaricato.`,
    detail: "Posso chiudere l'app, installare l'aggiornamento e riaprire Routy."
  });

  if (result.response !== 0) {
    return;
  }

  try {
    await stopBeforeInstall();
    autoUpdater.quitAndInstall(false, true);
  } catch (error) {
    promptedDownloadedVersion = null;

    await dialog.showMessageBox(getParentWindow(), {
      type: "error",
      title: "Installazione non riuscita",
      message: "Non sono riuscito a preparare Routy per l'installazione automatica.",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function checkForUpdates() {
  if (!supportsDesktopAutoUpdate() || checkInFlight) {
    return;
  }

  checkInFlight = true;

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("desktop auto update check failed", error);
  } finally {
    checkInFlight = false;
  }
}

export function startDesktopAutoUpdater(options = {}) {
  resolveParentWindow = typeof options.getParentWindow === "function" ? options.getParentWindow : () => null;
  stopBeforeInstall = typeof options.stopBeforeInstall === "function" ? options.stopBeforeInstall : async () => {};

  if (updaterStarted || !supportsDesktopAutoUpdate()) {
    return;
  }

  updaterStarted = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    const version = typeof info?.version === "string" ? info.version.trim() : "";

    if (!version || notifiedAvailableVersion === version) {
      return;
    }

    notifiedAvailableVersion = version;

    void dialog.showMessageBox(getParentWindow(), {
      type: "info",
      title: "Aggiornamento disponibile",
      buttons: ["OK"],
      defaultId: 0,
      message: `È disponibile Routy ${version}.`,
      detail: "Sto scaricando l'aggiornamento in background. Ti avviserò quando sarà pronto."
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    const version = typeof info?.version === "string" ? info.version.trim() : "";
    void maybePromptForDownloadedUpdate(version);
  });

  autoUpdater.on("error", (error) => {
    console.error("desktop auto update error", error);
  });

  void checkForUpdates();

  checkTimer = setInterval(() => {
    void checkForUpdates();
  }, updateCheckIntervalMs);

  app.once("before-quit", () => {
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
  });
}
