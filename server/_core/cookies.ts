import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(req: Request): CookieOptions {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const externalProto = typeof forwardedProto === "string"
    ? forwardedProto.split(",")[0]?.trim().toLowerCase()
    : undefined;
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = typeof forwardedHost === "string" ? forwardedHost : req.headers.host;
  const hostname = (hostHeader ?? "").split(",")[0]?.split(":")[0]?.trim().toLowerCase();
  const localHttp = !externalProto && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1");
  const secure = externalProto ? externalProto === "https" : !localHttp;

  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure,
  };
}
