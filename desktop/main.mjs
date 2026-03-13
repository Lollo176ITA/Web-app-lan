import { app, BrowserWindow, dialog } from "electron";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../dist/server/app.js";
import { ensureLocalHttpsCertificate } from "../dist/server/https.js";
import { getSessionHosts } from "../dist/server/network.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = !app.isPackaged;
const desktopPort = Number.parseInt(process.env.PORT ?? "8787", 10);
const desktopHttpsPort = Number.parseInt(process.env.HTTPS_PORT ?? String(desktopPort + 1), 10);
const desktopHost = "0.0.0.0";

let mainWindow = null;
let activeServer = null;
let activeSecureServer = null;
let activeApp = null;

async function startRouteroomServer() {
  if (activeServer) {
    return;
  }

  const staticDir = path.resolve(__dirname, "../dist/client");
  const storageRoot = path.join(app.getPath("userData"), "storage");
  const httpsRoot = path.join(app.getPath("userData"), "https");
  const { certificateHosts } = getSessionHosts();
  const tlsCertificate = await ensureLocalHttpsCertificate(httpsRoot, certificateHosts);

  const created = await createApp({
    port: desktopPort,
    httpsPort: desktopHttpsPort,
    seedDemo: true,
    staticDir,
    storageRoot,
    listenHost: desktopHost
  });

  await new Promise((resolve, reject) => {
    const server = created.app.listen(desktopPort, desktopHost, () => {
      activeServer = server;
      activeApp = created;
      resolve();
    });

    server.on("error", reject);
  });

  await new Promise((resolve, reject) => {
    const secureServer = https.createServer(
      {
        key: tlsCertificate.key,
        cert: tlsCertificate.cert
      },
      created.app
    );

    secureServer.listen(desktopHttpsPort, desktopHost, () => {
      activeSecureServer = secureServer;
      resolve();
    });

    secureServer.on("error", reject);
  });
}

async function stopRouteroomServer() {
  activeApp?.close();

  if (!activeServer && !activeSecureServer) {
    activeApp = null;
    return;
  }

  const server = activeServer;
  const secureServer = activeSecureServer;
  activeServer = null;
  activeSecureServer = null;
  activeApp = null;

  await Promise.all([
    new Promise((resolve) => {
      if (!server) {
        resolve();
        return;
      }

      server.close(() => resolve());
    }),
    new Promise((resolve) => {
      if (!secureServer) {
        resolve();
        return;
      }

      secureServer.close(() => resolve());
    })
  ]);
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
    title: "Routy",
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
      title: "Routy non avviato",
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

  if (activeApp || activeServer || activeSecureServer) {
    app.exitCode = 0;
  }
});

app.on("will-quit", (event) => {
  if (!activeApp && !activeServer && !activeSecureServer) {
    return;
  }

  event.preventDefault();
  void stopRouteroomServer().finally(() => {
    app.exit();
  });
});
