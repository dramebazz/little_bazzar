import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { storeRuntimeScript } from "./server/_core/publicConfig";

const devAllowedHosts = (process.env.DEV_ALLOWED_HOSTS ?? "")
  .split(",")
  .map(host => host.trim())
  .filter(Boolean);

function vitePluginStoreRuntimeConfig(): Plugin {
  return {
    name: "store-runtime-config",
    configureServer(server) {
      server.middlewares.use("/api/config.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(storeRuntimeScript());
      });
    },
    generateBundle() {
      if (process.env.VERCEL) return;
      this.emitFile({ type: "asset", fileName: "api/config.js", source: storeRuntimeScript() });
    },
  };
}

export default defineConfig({
  plugins: [vitePluginStoreRuntimeConfig(), react(), tailwindcss(), jsxLocPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [...devAllowedHosts, "localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
