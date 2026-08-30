// Thin wrappers around the BAE AI Gateway pass-through.
// Never call an AI provider (or the Lovable AI gateway) directly from here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const callAiProxy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ agent_slug: z.string().min(1), input: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { gatewayComplete } = await import("@/lib/ai-proxy.server");
    const { status, body } = await gatewayComplete(data);
    return { status, body };
  });

export const gatewayStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gatewayConfigured } = await import("@/lib/ai-proxy.server");
    return { configured: gatewayConfigured() };
  });

export const gatewayPing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gatewayComplete } = await import("@/lib/ai-proxy.server");
    const started = Date.now();
    try {
      const { status, body } = await gatewayComplete({
        agent_slug: "walkthrough-wizard-qa",
        input: "Reply with exactly: pong",
      });
      const b = body as { output?: string; model?: string; error?: string } | null;
      return {
        ok: status >= 200 && status < 300,
        status,
        ms: Date.now() - started,
        output: b?.output?.slice(0, 200) ?? null,
        model: b?.model ?? null,
        error: b?.error ?? null,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        ms: Date.now() - started,
        output: null,
        model: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

// --- Credits (gateway-owned; this app stores no balances) ---

export const ensureCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { gatewayCredits } = await import("@/lib/ai-proxy.server");
    return gatewayCredits({ action: "ensure", external_user_id: context.userId });
  });

export const creditBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { gatewayCredits } = await import("@/lib/ai-proxy.server");
    return gatewayCredits({ action: "balance", external_user_id: context.userId });
  });

export const purchaseCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pack: z.enum(["small", "medium", "large"]),
        success_url: z.string().url(),
        cancel_url: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { gatewayCredits } = await import("@/lib/ai-proxy.server");
    return gatewayCredits({
      action: "purchase",
      external_user_id: context.userId,
      pack: data.pack,
      success_url: data.success_url,
      cancel_url: data.cancel_url,
    });
  });
