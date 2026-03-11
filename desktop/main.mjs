import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../dist/server/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = !app.isPackaged;
const desktopPort = Number.parseInt(process.env.PORT ?? "8787", 10);

let mainWindow = null;
let activeServer = null;
let activeApp = null;

async function startRouteroomServer() {
  if (activeServer) {
    return;
  }

  const staticDir = path.resolve(__dirname, "../dist/client");
  const storageRoot = path.join(app.getPath("userData"), "storage");

  const created = await createApp({
    port: desktopPort,
    seedDemo: true,
    staticDir,
    storageRoot
  });

  await new Promise((resolve, reject) => {
    const server = created.app.listen(desktopPort, "127.0.0.1", () => {
      activeServer = server;
      activeApp = created;
      resolve();
    });

    server.on("error", reject);
  });
}

async function stopRouteroomServer() {
  activeApp?.close();

  if (!activeServer) {
    activeApp = null;
    return;
  }

  const server = activeServer;
  activeServer = null;
  activeApp = null;

  await new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function createMainWindow() {
  await startRouteroomServer();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#0f1115",
    autoHideMenuBar: true,
    title: "Routeroom",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`http://127.0.0.1:${desktopPort}`);

  if (isDevelopment) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await dialog.showMessageBox({
      type: "error",
      title: "Routeroom non avviato",
      message: "Non sono riuscito ad avviare il server desktop.",
      detail
    });
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (!app.isReady()) {
    return;
  }

  if (activeApp || activeServer) {
    app.exitCode = 0;
  }
});

app.on("will-quit", (event) => {
  if (!activeApp && !activeServer) {
    return;
  }

  event.preventDefault();
  void stopRouteroomServer().finally(() => {
    app.exit();
  });
});
