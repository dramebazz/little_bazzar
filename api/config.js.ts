import type { HttpResponse } from "../server/_core/httpTypes.js";

export default function config(_req: unknown, rawResponse: unknown) {
  const res = rawResponse as HttpResponse;
  const runtimeConfig = {
    publicApiUrl: process.env.PUBLIC_API_URL ?? "",
    publicApiKey: process.env.PUBLIC_API_KEY ?? "",
  };
  const script = `window.__STORE_CONFIG__=${JSON.stringify(runtimeConfig).replaceAll("<", "\\u003c")};`;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(script);
}
