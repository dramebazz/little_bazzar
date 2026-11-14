import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy.js";
import { storeRuntimeScript } from "./publicConfig.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";

export function createApiApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(storeRuntimeScript());
  });
  registerStorageProxy(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[API] Unhandled request error", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
