// Pathway health checks — verify the deployable surfaces (AI gateway, Firecrawl, env).
import { createServerFn } from "@tanstack/react-start";

export const checkAiGateway = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { ok: false as const, error: "LOVABLE_API_KEY not set" };
  try {
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateText } = await import("ai");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");
    const started = Date.now();
    const { text } = await generateText({ model, prompt: "Reply with exactly: pong" });
    return { ok: true as const, ms: Date.now() - started, reply: text.slice(0, 80) };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
});

export const checkFirecrawl = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { ok: false as const, error: "FIRECRAWL_API_KEY not set" };
  try {
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey: key });
    const started = Date.now();
    const res: any = await fc.map("https://example.com", { limit: 1 });
    const links = Array.isArray(res?.links) ? res.links.length : 0;
    return { ok: true as const, ms: Date.now() - started, links };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
});

export const checkEnv = createServerFn({ method: "GET" }).handler(async () => {
  return {
    LOVABLE_API_KEY: Boolean(process.env.LOVABLE_API_KEY),
    FIRECRAWL_API_KEY: Boolean(process.env.FIRECRAWL_API_KEY),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
  };
});
