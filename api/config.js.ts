import type { Request, Response } from "express";

export default function config(_req: Request, res: Response) {
  const runtimeConfig = {
    publicApiUrl: process.env.PUBLIC_API_URL ?? "",
    publicApiKey: process.env.PUBLIC_API_KEY ?? "",
  };
  const script = `window.__STORE_CONFIG__=${JSON.stringify(runtimeConfig).replaceAll("<", "\\u003c")};`;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(script);
}
