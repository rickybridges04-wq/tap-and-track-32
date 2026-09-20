// Server-only auth for the external Playwright worker endpoints.
// Authenticated ONLY by "Authorization: Bearer <QA_WORKER_TOKEN>".

/** Constant-time string compare that does not leak length via early return. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Compare over a fixed length so mismatched lengths still cost the same.
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/** Returns null when the request is authorized, or a 401 Response when not. */
export function requireWorkerToken(request: Request): Response | null {
  const expected = process.env["QA_WORKER_TOKEN"];
  if (!expected) {
    console.error("QA_WORKER_TOKEN is not configured");
    return new Response("Unauthorized", { status: 401 });
  }
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  const presented = header.startsWith(prefix) ? header.slice(prefix.length) : "";
  if (!timingSafeEqual(presented, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
