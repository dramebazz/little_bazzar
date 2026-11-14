import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminSessionToken, verifyAdminCredentials, verifyAdminSessionToken } from "./_core/adminAuth";

const testPassword = "test-only-password-2026";
const signingSecret = "test-only-signing-secret-with-at-least-32-bytes";

function createHash(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", 16_384, 8, 1, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

afterEach(() => vi.unstubAllEnvs());

describe("owner admin authentication", () => {
  it("accepts only the configured owner email and matching password", async () => {
    vi.stubEnv("STORE_ADMIN_EMAIL", "owner@example.com");
    vi.stubEnv("STORE_ADMIN_PASSWORD_HASH", createHash(testPassword));
    vi.stubEnv("APP_SESSION_SECRET", signingSecret);
    await expect(verifyAdminCredentials("OWNER@example.com", testPassword)).resolves.toBe(true);
    await expect(verifyAdminCredentials("someone@example.com", testPassword)).resolves.toBe(false);
    await expect(verifyAdminCredentials("owner@example.com", "wrong-password")).resolves.toBe(false);
  });

  it("signs a session only for the configured email and invalidates it if owner settings change", async () => {
    vi.stubEnv("STORE_ADMIN_EMAIL", "owner@example.com");
    vi.stubEnv("APP_SESSION_SECRET", signingSecret);
    const token = await createAdminSessionToken("OWNER@example.com");
    await expect(verifyAdminSessionToken(token)).resolves.toEqual({ email: "owner@example.com" });
    await expect(createAdminSessionToken("other@example.com")).rejects.toThrow("Only the configured store owner");
    vi.stubEnv("STORE_ADMIN_EMAIL", "other@example.com");
    await expect(verifyAdminSessionToken(token)).resolves.toBeNull();
  });
});
