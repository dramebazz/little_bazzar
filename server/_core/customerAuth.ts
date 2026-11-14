import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { CUSTOMER_SESSION_MS } from "../../shared/const.js";
import { ENV } from "./env.js";
import type { HttpRequest } from "./httpTypes.js";
import type { Collection, Document } from "mongodb";
import type { CustomerAccountDoc } from "../shopMongoDb.js";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAXMEM = 64 * 1024 * 1024;
const ISSUER = "little-bazaar";
const AUDIENCE = "little-bazaar-customer";

export const recoveryQuestions = [
  "What was the name of your first school?",
  "What is the name of your childhood best friend?",
  "What was your first pet’s name?",
  "What is your favourite food?",
] as const;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAXMEM }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashCustomerSecret(value: string) {
  const salt = randomBytes(16);
  const digest = await derive(value, salt);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), digest.toString("base64url")].join("$");
}

export async function verifyCustomerSecret(value: string, encoded: string) {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== String(SCRYPT_N) || parts[2] !== String(SCRYPT_R) || parts[3] !== String(SCRYPT_P)) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;
  const actual = await derive(value, salt);
  return timingSafeEqual(actual, expected);
}

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createCustomerSession(email: string) {
  const normalized = normalizedEmail(email);
  return new SignJWT({ email: normalized, role: "customer" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(normalized)
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + CUSTOMER_SESSION_MS) / 1000))
    .sign(new TextEncoder().encode(ENV.cookieSecret));
}

export async function verifyCustomerSession(token: string | undefined | null) {
  if (!token || ENV.cookieSecret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(ENV.cookieSecret), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
    const email = typeof payload.email === "string" ? normalizedEmail(payload.email) : "";
    return email && payload.sub === email && payload.role === "customer" ? { email } : null;
  } catch {
    return null;
  }
}

export async function authenticateCustomerRequest(req: HttpRequest) {
  const header = req.headers.cookie;
  const match = typeof header === "string" ? header.split(";").map(value => value.trim()).find(value => value.startsWith("little_bazaar_customer_session=")) : undefined;
  return verifyCustomerSession(match?.slice(match.indexOf("=") + 1));
}

export function normalizeCustomerEmail(email: string) {
  return normalizedEmail(email);
}

export function validateCustomerPassword(password: string) {
  if (password.length < 8 || password.length > 128) throw new TRPCError({ code: "BAD_REQUEST", message: "Password must be 8–128 characters." });
}

export type CustomerCollection = Collection<CustomerAccountDoc & Document>;
