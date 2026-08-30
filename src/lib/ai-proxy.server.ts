// BAE AI Gateway pass-through (server-only).
// The gateway owns prompts, model selection, retries and credits.
// This file is a thin authenticated forwarder: the API key never leaves the server.

const GATEWAY_BASE = "https://pdlyoaekgszvbvmxgrdc.supabase.co/functions/v1";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type GatewayResult = {
  status: number;
  body: JsonValue;
};

function apiKey(): string {
  const key = process.env["AI_GATEWAY_API_KEY"];
  if (!key) throw new Error("AI_GATEWAY_API_KEY is not configured");
  return key;
}

async function post(path: string, payload: unknown): Promise<GatewayResult> {
  // No client-side timeout: generation can legitimately take minutes.
  const res = await fetch(`${GATEWAY_BASE}/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey(),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body: JsonValue;
  try {
    body = text ? (JSON.parse(text) as JsonValue) : null;
  } catch {
    body = { error: text };
  }
  return { status: res.status, body };
}

/** POST /v1-complete — text completion through the gateway. */
export function gatewayComplete(payload: { agent_slug: string; input: string }) {
  return post("v1-complete", payload);
}

/** POST /v1-credits — ensure | balance | purchase. */
export function gatewayCredits(payload: Record<string, unknown>) {
  return post("v1-credits", payload);
}

/** POST /v1-media-generate — paid media generation (credits enforced by gateway). */
export function gatewayMediaGenerate(payload: Record<string, unknown>) {
  return post("v1-media-generate", payload);
}

export function gatewayConfigured(): boolean {
  return Boolean(process.env["AI_GATEWAY_API_KEY"]);
}
