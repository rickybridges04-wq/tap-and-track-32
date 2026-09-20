// Pure error-signature helpers: identical failures must hash identically so
// several failing cases can be grouped under one root cause.

/** Strip volatile detail (ids, numbers, hex, whitespace) from an error message. */
export function normalizeErrorMessage(message: string | null | undefined): string {
  return (message ?? "")
    .toLowerCase()
    .replace(/0x[0-9a-f]+/g, "<hex>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, "<uuid>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

/** sha256 hex of the normalized message plus the failing step's selector. */
export async function errorSignature(
  status: "pass" | "fail" | "error",
  message: string | null | undefined,
  selector: string | null,
): Promise<string | null> {
  if (status === "pass") return null;
  const input = `${normalizeErrorMessage(message)}|${selector ?? ""}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
