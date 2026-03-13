import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ensureLocalHttpsCertificate } from "./server/https";
import { getSessionHosts } from "./server/network";

export default defineConfig(async () => {
  const httpsCertDir = process.env.HTTPS_CERT_DIR ?? path.resolve(process.cwd(), ".tmp/https");
  const { certificateHosts } = getSessionHosts();
  const tlsCertificate = await ensureLocalHttpsCertificate(httpsCertDir, certificateHosts);

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("@mui") || id.includes("@emotion")) {
              return "mui";
            }

            if (id.includes("/qrcode/")) {
              return "qrcode";
            }

            return undefined;
          }
        }
      }
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      https: {
        key: tlsCertificate.key,
        cert: tlsCertificate.cert
      },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8787",
          changeOrigin: true
        }
      }
    }
  };
});
