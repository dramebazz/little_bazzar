import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy.js";
import { storeRuntimeScript } from "./publicConfig.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";

type ApiResponse = {
  headersSent: boolean;
  json(body: unknown): unknown;
  send(body: string): unknown;
  set(field: string, value: string): ApiResponse;
  status(code: number): ApiResponse;
  type(value: string): ApiResponse;
};

export function createApiApp() {
  const app = express();
  const healthHandler = (_req: unknown, rawResponse: unknown) => {
    const res = rawResponse as ApiResponse;
    res.json({ status: "ok" });
  };
  const configHandler = (_req: unknown, rawResponse: unknown) => {
    const res = rawResponse as ApiResponse;
    res.set("Cache-Control", "no-store");
    res.type("application/javascript");
    res.send(storeRuntimeScript());
  };
  const errorHandler = (error: unknown, _req: unknown, rawResponse: unknown, _next: unknown) => {
    const res = rawResponse as ApiResponse;
    console.error("[API] Unhandled request error", error instanceof Error ? error.message : "unknown error");
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  };
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", healthHandler);
  app.get("/api/config.js", configHandler);
  registerStorageProxy(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.use(errorHandler);
  return app;
}
