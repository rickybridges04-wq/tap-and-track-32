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

function hasInputImage(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false;
  return (messages as Array<{ content?: unknown }>).some(
    (m) => Array.isArray(m?.content) && (m.content as Array<{ type?: string }>).some((p) => p?.type === "image_url"),
  );
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
    // Editing a user's photo needs an image-edit provider the gateway doesn't have yet.
    // Never fake it with a fresh image that ignores their photo.
    if (hasInputImage(payload["messages"])) {
      return gwError(501, "Photo-based edits are being moved to the BAE AI Gateway and are temporarily unavailable.");
    }
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


/** Video via the gateway (paid apps only call this). POST /videos starts a queued job
 *  (v1-media-generate, video-gen); GET /videos/{id} polls it (v1-media-status).
 *  Responses keep the old shape: { id, status: pending|processing|completed|failed, url }. */
async function baeGatewayVideo(key: string, url: string, payload: Record<string, unknown>): Promise<Response> {
  const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
  const m = url.match(/\/videos\/([^/?]+)/);
  if (!m) {
    const prompt = String(payload["prompt"] ?? "").slice(0, 3800);
    if (!prompt) return gwError(400, "Video prompt is empty");
    const res = await fetch(`${BAE_GATEWAY_BASE}/v1-media-generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        external_user_id: "app-house", task_type: "video-gen", tier: "standard", prompt, promote: true,
        aspect_ratio: payload["aspect_ratio"], duration_seconds: Number(payload["duration"] ?? 5) || 5,
      }),
    });
    const d = (await res.json().catch(() => ({}))) as { request_id?: string; storage_url?: string; error?: string };
    if (!res.ok || !d.request_id) return gwError(res.ok ? 502 : res.status, d.error ?? "Video generation failed");
    return ok({ id: d.request_id, status: d.storage_url ? "completed" : "pending", url: d.storage_url });
  }
  const id = decodeURIComponent(m[1]!);
  const res = await fetch(`${BAE_GATEWAY_BASE}/v1-media-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ request_id: id }),
  });
  const d = (await res.json().catch(() => ({}))) as { status?: string; storage_url?: string; error?: string; output?: { storage_url?: string } };
  if (!res.ok) return gwError(res.status, d.error ?? "Video status check failed");
  const st = String(d.status ?? "queued");
  const done = d.storage_url ?? d.output?.storage_url;
  if (st === "error") return ok({ id, status: "failed", error: d.error ?? "Video render failed" });
  if (st === "success" && done) return ok({ id, status: "completed", url: done });
  return ok({ id, status: "processing" });
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
export async function baeCompatFetch(input: unknown, init?: { body?: unknown; [k: string]: unknown } | RequestInit): Promise<Response> {
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
  if (url.includes("/videos")) {
    const key = baeKey();
    if (!key) return gwError(503, "AI is not configured for this app yet (AI_GATEWAY_API_KEY missing).");
    return await baeGatewayVideo(key, url, payload);
  }
  if (url.includes("/audio/")) {
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
export async function baeSdkFetch(input: unknown, init?: RequestInit): Promise<Response> {
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
