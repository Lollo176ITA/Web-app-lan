import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.resolve(currentDirectory, "../client");
const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const storageRoot = process.env.STORAGE_ROOT;

const { app, urls } = await createApp({
  port,
  seedDemo: true,
  staticDir,
  storageRoot,
  listenHost: "0.0.0.0"
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log("Routy attivo");
  console.log(`Locale: ${urls.localUrl}`);
  console.log(`LAN:    ${urls.lanUrl}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
