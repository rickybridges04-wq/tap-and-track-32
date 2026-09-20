// Pure, browser-safe API key helpers. Only the SHA-256 hash is ever stored.
const PREFIX = "sqa_";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** A fresh key: "sqa_" + 64 hex chars. Shown to the user exactly once. */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return PREFIX + toHex(bytes);
}

/** The short, non-secret portion stored alongside the hash for display. */
export function keyPrefix(key: string): string {
  return key.slice(0, PREFIX.length + 8);
}

export function looksLikeApiKey(key: string): boolean {
  return /^sqa_[0-9a-f]{64}$/.test(key);
}

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return toHex(new Uint8Array(digest));
}

/** Constant-time hex comparison of a presented key against a stored hash. */
export async function verifyApiKey(key: string, storedHash: string): Promise<boolean> {
  const hash = await hashApiKey(key);
  if (hash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return diff === 0;
}
