import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  keyPrefix,
  looksLikeApiKey,
} from "./api-keys";

describe("API keys", () => {
  it("generates a prefixed 64-hex key that passes the format check", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^sqa_[0-9a-f]{64}$/);
    expect(looksLikeApiKey(key)).toBe(true);
    expect(keyPrefix(key)).toBe(key.slice(0, 12));
  });

  it("does not repeat keys", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateApiKey()));
    expect(keys.size).toBe(200);
  });

  it("rejects malformed keys", () => {
    expect(looksLikeApiKey("")).toBe(false);
    expect(looksLikeApiKey("sqa_short")).toBe(false);
    expect(looksLikeApiKey("pk_" + "a".repeat(64))).toBe(false);
    expect(looksLikeApiKey("sqa_" + "Z".repeat(64))).toBe(false);
  });

  it("hashes to stable 64-hex digests that differ per key", async () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(await hashApiKey(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashApiKey(a)).toBe(await hashApiKey(a));
    expect(await hashApiKey(a)).not.toBe(await hashApiKey(b));
    expect(await hashApiKey(a)).not.toBe(a);
  });

  it("verifies only the matching key", async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    expect(await verifyApiKey(key, hash)).toBe(true);
    expect(await verifyApiKey(generateApiKey(), hash)).toBe(false);
    expect(await verifyApiKey(key, "deadbeef")).toBe(false);
  });
});
