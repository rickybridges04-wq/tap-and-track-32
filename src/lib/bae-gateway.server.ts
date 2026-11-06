// ── BAE AI Gateway shim (2026-11-06, v3.1) ────────────────────────────────────
// Standing rule: app AI goes through the BAE AI Gateway, never Lovable AI.
// Drop-in replacement for calls that used to go to ai.gateway.lovable.dev:
//   /chat/completions     -> v1-complete (text, JSON, tools, images-in, streaming)
//   /images/generations   -> v1-media-generate (and modalities:["image"] chat calls)
//   /videos, /audio/*     -> 501 "temporarily unavailable" (no gateway endpoint yet)
// Responses keep the OpenAI shape, so existing callers work unchanged.
// No fallback to Lovable AI: that would spend the 30-credit reserve that keeps apps running.
const BAE_GATEWAY_BASE = "https://pdlyoaekgszvbvmxgrdc.supabase.co/functions/v1";
export const BAE_AGENT_SLUG = "walkthrough-wizard-ai";

function baeKey(): string | undefined {
  return process.env.AI_GATEWAY_API_KEY;
}

function gwError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function promptText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  const parts: string[] = [];
  for (const m of messages as Array<{ role?: string; content?: unknown }>) {
    if (m?.role === "assistant") continue;
    if (typeof m?.content === "string") parts.push(m.content);
    else if (Array.isArray(m?.content)) {
      for (const p of m.content as Array<{ type?: string; text?: string }>) {
        if (p?.type === "text" && typeof p.text === "string") parts.push(p.text);
      }
    }
  }
  return parts.join("\n\n").slice(0, 3800);
}

async function toBase64(url: string): Promise<{ b64: string; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { b64: btoa(bin), mime };
  } catch {
    return null;
  }
}

async function mediaImage(key: string, prompt: string, tier: "draft" | "standard" | "premium" = "draft") {
  const res = await fetch(`${BAE_GATEWAY_BASE}/v1-media-generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ external_user_id: "app-house", task_type: "image-gen", tier, prompt, promote: true }),
  });
  const data = (await res.json().catch(() => ({}))) as { storage_url?: string; error?: string };
  return { ok: res.ok && !!data.storage_url, status: res.ok ? 502 : res.status, url: data.storage_url, error: data.error };
}

/** Image generation; returns the chat-completions image shape (message.images[0].image_url.url)
 *  as a data: URL, exactly like Lovable AI did (falls back to the hosted URL). */
export async function baeGatewayImage(key: string, prompt: string, tier: "draft" | "standard" | "premium" = "draft"): Promise<Response> {
  const r = await mediaImage(key, prompt, tier);
  if (!r.ok) return gwError(r.status, r.error ?? "Image generation failed");
  const enc = await toBase64(r.url!);
  const url = enc ? `data:${enc.mime};base64,${enc.b64}` : r.url;
  return new Response(
    JSON.stringify({ choices: [{ message: { role: "assistant", content: "", images: [{ type: "image_url", image_url: { url } }] } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** OpenAI chat-completions body in, gateway Response out. */
export async function baeGatewayFetch(payload: Record<string, unknown>): Promise<Response> {
  const key = baeKey();
  if (!key) return gwError(503, "AI is not configured for this app yet (AI_GATEWAY_API_KEY missing).");
  const modalities = payload["modalities"];
  if (Array.isArray(modalities) && modalities.includes("image")) {
    const prompt = promptText(payload["messages"]);
    if (!prompt) return gwError(400, "Image prompt is empty");
    return await baeGatewayImage(key, prompt);
  }
  const body: Record<string, unknown> = { agent_slug: BAE_AGENT_SLUG };
  for (const k of ["messages", "tools", "tool_choice", "response_format", "stream"]) {
    if (payload[k] !== undefined) body[k] = payload[k];
  }
  return await fetch(`${BAE_GATEWAY_BASE}/v1-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
  });
}

function parseBody(init?: { body?: unknown }): Record<string, unknown> {
  try {
    const b = init?.body;
    if (typeof b === "string") return JSON.parse(b);
    if (b instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(b));
  } catch { /* fall through */ }
  return {};
}

/**
 * Drop-in for `fetch(<ai.gateway.lovable.dev URL>, init)`. Pass the same
 * arguments; the request is served by the BAE gateway instead.
 */
export async function baeCompatFetch(input: unknown, init?: { body?: unknown }): Promise<Response> {
  const url = typeof input === "string" ? input : String((input as { url?: string })?.url ?? input);
  const payload = parseBody(init);
  if (url.includes("/images/generations")) {
    const key = baeKey();
    if (!key) return gwError(503, "AI is not configured for this app yet (AI_GATEWAY_API_KEY missing).");
    const q = String(payload["quality"] ?? "");
    const tier = q === "high" ? "premium" : q === "medium" ? "standard" : "draft";
    const r = await mediaImage(key, String(payload["prompt"] ?? "").slice(0, 3800), tier);
    if (!r.ok) return gwError(r.status, r.error ?? "Image generation failed");
    const enc = await toBase64(r.url!);
    return new Response(JSON.stringify({ created: Math.floor(Date.now() / 1000), data: [{ url: r.url, ...(enc ? { b64_json: enc.b64 } : {}) }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (url.includes("/videos") || url.includes("/audio/")) {
    return gwError(501, "This media feature is moving to the BAE gateway and is temporarily unavailable.");
  }
  return await baeGatewayFetch(payload);
}

/**
 * `fetch` for AI SDK providers (createOpenAICompatible({ ..., fetch: baeSdkFetch })).
 * Always calls the gateway non-streaming and, when the SDK asked for a stream,
 * replays the full result as an OpenAI-style SSE stream (reliable with tools
 * and structured output).
 */
export async function baeSdkFetch(input: unknown, init?: { body?: unknown }): Promise<Response> {
  const url = typeof input === "string" ? input : String((input as { url?: string })?.url ?? input);
  if (!url.includes("/chat/completions")) return baeCompatFetch(input, init);
  const payload = parseBody(init);
  const wantStream = payload["stream"] === true;
  const res = await baeGatewayFetch({ ...payload, stream: false });
  if (!res.ok) return res;
  const data = (await res.json()) as {
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: Array<{ message?: { role?: string; content?: string | null; tool_calls?: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }> } }>;
  };
  const msg = data.choices?.[0]?.message ?? {};
  const toolCalls = (msg.tool_calls ?? []).map((t, i) => ({
    index: i,
    id: t.id ?? `call_${i}`,
    type: "function",
    function: { name: t.function?.name ?? "", arguments: t.function?.arguments ?? "{}" },
  }));
  const finish = toolCalls.length ? "tool_calls" : "stop";
  const id = `bae-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = data.model ?? "bae-gateway";
  const usage = {
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    total_tokens: (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
  };
  if (!wantStream) {
    return new Response(
      JSON.stringify({
        id, object: "chat.completion", created, model,
        choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", content: msg.content ?? null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) } }],
        usage,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  const chunks: unknown[] = [
    { id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { role: "assistant", content: msg.content ?? "", ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }, finish_reason: null }] },
    { id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: finish }], usage },
  ];
  const sse = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
// ─────────────────────────────────────────────────────────────────────────────
