import type { CookieOptions } from "express";
import type { HttpRequest } from "./httpTypes.js";

export function getSessionCookieOptions(req: HttpRequest): CookieOptions {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const externalProto = typeof forwardedProto === "string"
    ? forwardedProto.split(",")[0]?.trim().toLowerCase()
    : undefined;
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = typeof forwardedHost === "string"
    ? forwardedHost
    : typeof req.headers.host === "string" ? req.headers.host : undefined;
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
