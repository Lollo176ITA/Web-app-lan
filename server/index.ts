import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { ensureLocalHttpsCertificate } from "./https.js";
import { getSessionHosts } from "./network.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(currentDirectory, "../client");
const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const httpsPort = Number.parseInt(process.env.HTTPS_PORT ?? String(port + 1), 10);
const storageRoot = process.env.STORAGE_ROOT;
const httpsCertDir = process.env.HTTPS_CERT_DIR ?? path.resolve(process.cwd(), ".tmp/https");
const { certificateHosts } = getSessionHosts();
const tlsCertificate = await ensureLocalHttpsCertificate(httpsCertDir, certificateHosts);

const { app, urls } = await createApp({
  port,
  httpsPort,
  seedDemo: true,
  staticDir,
  storageRoot,
  listenHost: "0.0.0.0"
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log("Routy attivo");
  console.log(`Locale: ${urls.localUrl}`);
  console.log(`LAN:    ${urls.lanUrl}`);
  if (urls.secureLocalUrl && urls.secureLanUrl) {
    console.log(`HTTPS locale: ${urls.secureLocalUrl}`);
    console.log(`HTTPS LAN:    ${urls.secureLanUrl}`);
    console.log(`Certificato:  ${tlsCertificate.certPath}`);
  }
});

const secureServer = https.createServer(
  {
    key: tlsCertificate.key,
    cert: tlsCertificate.cert
  },
  app
);

secureServer.listen(httpsPort, "0.0.0.0");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    let pending = 2;
    const done = () => {
      pending -= 1;

      if (pending === 0) {
        process.exit(0);
      }
    };

    server.close(done);
    secureServer.close(done);
  });
}
