// Bearer-API-key authentication + per-key rate limiting for /api/v1/*.
import { hashApiKey, looksLikeApiKey } from "@/lib/api-keys";

export type ApiCaller = { userId: string; keyId: string };

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
// Per-isolate counter. Good enough to stop runaway CI loops; not a global limit.
const hits = new Map<string, number[]>();

export function rateLimited(keyId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(keyId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(keyId, recent);
  return recent.length > MAX_PER_WINDOW;
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

/** Resolves the caller from "Authorization: Bearer <api key>", or returns a Response. */
export async function authenticateApiKey(request: Request): Promise<ApiCaller | Response> {
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!looksLikeApiKey(presented)) {
    return json({ error: "Missing or malformed API key" }, 401);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await hashApiKey(presented);
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error) {
    console.error("api key lookup failed:", error.message);
    return json({ error: "Key lookup failed" }, 500);
  }
  if (!data || data.revoked_at) return json({ error: "Invalid or revoked API key" }, 401);

  if (rateLimited(data.id)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded: 30 requests per minute" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id, keyId: data.id };
}
