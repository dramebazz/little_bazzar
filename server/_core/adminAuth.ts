import { parse as parseCookieHeader } from "cookie";
import { timingSafeEqual } from "node:crypto";
import { scrypt as scryptCallback } from "node:crypto";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME, ADMIN_SESSION_MS } from "../../shared/const";
import { ENV } from "./env";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const SESSION_ISSUER = "little-bazaar";
const SESSION_AUDIENCE = "little-bazaar-admin";

type PasswordHash = {
  salt: Buffer;
  digest: Buffer;
};

function sessionKey() {
  if (ENV.cookieSecret.length < 32) {
    throw new Error("Admin session signing key must contain at least 32 characters.");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

function parsePasswordHash(value: string): PasswordHash | null {
  const [scheme, n, r, p, saltText, digestText, extra] = value.split("$");
  if (scheme !== "scrypt" || n !== String(SCRYPT_N) || r !== String(SCRYPT_R) || p !== String(SCRYPT_P) || !saltText || !digestText || extra !== undefined) {
    return null;
  }
  try {
    const salt = Buffer.from(saltText, "base64url");
    const digest = Buffer.from(digestText, "base64url");
    if (salt.length < 16 || digest.length !== SCRYPT_KEY_LENGTH) return null;
    return { salt, digest };
  } catch {
    return null;
  }
}

function derivePasswordHash(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

export function isAdminLoginConfigured() {
  return Boolean(ENV.storeAdminEmail && ENV.storeAdminPasswordHash && ENV.cookieSecret.length >= 32);
}

export async function verifyAdminCredentials(email: string, password: string) {
  const configuredEmail = ENV.storeAdminEmail;
  const record = parsePasswordHash(ENV.storeAdminPasswordHash);
  if (!configuredEmail || !record || password.length < 1 || password.length > 128) return false;

  const derived = await derivePasswordHash(password, record.salt);
  const passwordMatches = timingSafeEqual(derived, record.digest);
  const emailMatches = email.trim().toLowerCase() === configuredEmail;
  return passwordMatches && emailMatches;
}

export async function createAdminSessionToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail !== ENV.storeAdminEmail) {
    throw new Error("Only the configured store owner can receive an admin session.");
  }
  const expiresAt = Math.floor((Date.now() + ADMIN_SESSION_MS) / 1000);
  return new SignJWT({ email: normalizedEmail, role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setSubject(normalizedEmail)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(sessionKey());
}

export async function verifyAdminSessionToken(token: string | undefined | null) {
  if (!token || !ENV.storeAdminEmail || ENV.cookieSecret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || email !== ENV.storeAdminEmail || payload.sub !== email || payload.role !== "admin") return null;
    return { email };
  } catch {
    return null;
  }
}

export async function authenticateAdminRequest(req: Request): Promise<User | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const session = await verifyAdminSessionToken(cookies[COOKIE_NAME]);
  if (!session) return null;
  const now = new Date();
  return {
    id: 0,
    openId: "store-owner",
    name: "Store owner",
    email: session.email,
    loginMethod: "password",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}
