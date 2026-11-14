import { afterEach, describe, expect, it, vi } from "vitest";
import { storeRuntimeConfig, storeRuntimeScript } from "./_core/publicConfig";
import { getSessionCookieOptions } from "./_core/cookies";
import { listLLMModels } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { COOKIE_NAME } from "../shared/const";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("store runtime configuration", () => {
  it("exposes only optional public map settings", () => {
    const env = {
      PUBLIC_API_URL: "https://maps.example",
      PUBLIC_API_KEY: "public-browser-test",
      SERVICE_API_KEY: "server-only-test",
      APP_SESSION_SECRET: "signing-only-test",
      STORE_ADMIN_PASSWORD_HASH: "password-hash-test",
      MONGODB_URI: "mongodb-uri-test",
    };
    expect(storeRuntimeConfig(env)).toEqual({ publicApiUrl: env.PUBLIC_API_URL, publicApiKey: env.PUBLIC_API_KEY });
    const script = storeRuntimeScript(env);
    expect(script).toContain("window.__STORE_CONFIG__");
    for (const value of [env.SERVICE_API_KEY, env.APP_SESSION_SECRET, env.STORE_ADMIN_PASSWORD_HASH, env.MONGODB_URI]) {
      expect(script).not.toContain(value);
    }
    const appended: unknown[] = [];
    const fakeDocument = { createElement: () => ({ setAttribute() {} }), head: { appendChild: (node: unknown) => appended.push(node) } };
    new Function("window", "document", script)({}, fakeDocument);
    expect(appended).toHaveLength(0);
    new Function("window", "document", storeRuntimeScript({}))({}, fakeDocument);
    expect(appended).toHaveLength(0);
  });

  it("does not guess a production API when the project environment is absent", async () => {
    vi.stubEnv("SERVICE_API_URL", ""); vi.stubEnv("SERVICE_API_KEY", "test-only");
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    await expect(listLLMModels()).rejects.toThrow("The model service URL is not configured.");
    expect(request).not.toHaveBeenCalled();
  });

  it("persists URL-only image results through generic asset storage", async () => {
    vi.stubEnv("SERVICE_API_URL", "https://api.example"); vi.stubEnv("SERVICE_API_KEY", "test-only");
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ image: { url: "https://image.example/result.png", mimeType: "image/png" } })))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://upload.example/object" })))
      .mockResolvedValueOnce(new Response(""));
    vi.stubGlobal("fetch", request);
    const image = await generateImage({ prompt: "test", originalImages: [] });
    expect(image.url).toMatch(/^\/api\/assets\/generated\//);
    expect(request).toHaveBeenCalledTimes(4);
    expect(JSON.parse(request.mock.calls[0][1].body)).toHaveProperty("originalImages");
  });

  it("sets cross-site secure cookies behind HTTPS and plain cookies on localhost", () => {
    expect(COOKIE_NAME).toBe("little_bazaar_admin_session");
    expect(getSessionCookieOptions({ protocol: "http", headers: { "x-forwarded-proto": "https" } } as never))
      .toMatchObject({ secure: true, httpOnly: true, sameSite: "none", path: "/" });
    expect(getSessionCookieOptions({ protocol: "http", headers: { host: "localhost:3000" } } as never))
      .toMatchObject({ secure: false, httpOnly: true, sameSite: "lax", path: "/" });
  });
});
