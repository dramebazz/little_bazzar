import express from "express";
import { ENV } from "./env.js";

type StorageApp = {
  get(path: string, handler: (req: StorageRequest, res: StorageResponse) => unknown): unknown;
};
type StorageRequest = { params: Record<string, string> };
type StorageResponse = {
  send(body: string): unknown;
  set(field: string, value: string): StorageResponse;
  status(code: number): StorageResponse;
  redirect(status: number, url: string): unknown;
};

export function registerStorageProxy(app: ReturnType<typeof express> & StorageApp) {
  const handler = async (req: StorageRequest, res: StorageResponse) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.serviceApiUrl || !ENV.serviceApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const serviceUrl = new URL(
        "v1/storage/presign/get",
        ENV.serviceApiUrl.replace(/\/+$/, "") + "/",
      );
      serviceUrl.searchParams.set("path", key);

      const serviceResponse = await fetch(serviceUrl, {
        headers: { Authorization: `Bearer ${ENV.serviceApiKey}` },
      });

      if (!serviceResponse.ok) {
        const body = await serviceResponse.text().catch(() => "");
        console.error(`[StorageProxy] service error: ${serviceResponse.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await serviceResponse.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  };

  app.get("/api/assets/*", handler);
}
