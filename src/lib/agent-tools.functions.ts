// Server-side executors for tools that touch the real world.
// Each returns a serializable { ok, data?, message } result.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolResult = { ok: boolean; data?: any; message: string };

// ── Bridges Tester ──────────────────────────────────────────────────────────
// The deploy target is Cloudflare Workers, which cannot run Playwright /
// headless Chromium. This tester issues a real HTTP GET against the URL and
// reports status, latency, byte size, and same-origin link count so a
// broken deploy is still caught — labeled clearly as an HTTP probe, not a
// browser walkthrough.
const TesterInput = z.object({
  url: z.string().url(),
  maxClicks: z.number().int().min(0).max(10).default(3),
});

export const runTester = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TesterInput.parse(input))
  .handler(async ({ data }): Promise<ToolResult> => {
    const started = Date.now();
    try {
      const res = await fetch(data.url, { redirect: "follow" });
      const html = await res.text();
      const latencyMs = Date.now() - started;
      const base = new URL(res.url);
      const hrefs = Array.from(html.matchAll(/href\s*=\s*"([^"]+)"/gi)).map((m) => m[1]);
      const sameOriginLinks = new Set<string>();
      for (const h of hrefs) {
        try {
          const u = new URL(h, base);
          if (u.origin === base.origin) {
            u.hash = "";
            sameOriginLinks.add(u.toString());
          }
        } catch {
          /* ignore malformed */
        }
      }
      const result = {
        finalUrl: res.url,
        status: res.status,
        latencyMs,
        bytes: html.length,
        sameOriginLinkCount: sameOriginLinks.size,
        sampleLinks: Array.from(sameOriginLinks).slice(0, 10),
      };
      const pass = res.ok;
      return {
        ok: true,
        data: result,
        message: `HTTP probe ${res.status} in ${latencyMs}ms, ${html.length} bytes, ${sameOriginLinks.size} same-origin links.${
          pass ? "" : " (non-2xx response)"
        } Note: server-runtime does not support a real browser walkthrough.`,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  });


// ── Risky: sendEmail (Resend via gateway) ───────────────────────────────────
const SendEmailInput = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  from: z.string().default("Bridges Ops <onboarding@resend.dev>"),
});

export const sendEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SendEmailInput.parse(input))
  .handler(async ({ data }): Promise<ToolResult> => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) {
      return { ok: false, message: "RESEND_API_KEY not configured — connect Resend to enable real email." };
    }
    try {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({ from: data.from, to: [data.to], subject: data.subject, html: data.html }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, data: body, message: `Resend ${res.status}` };
      return { ok: true, data: body, message: `Email sent to ${data.to}.` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

// ── Risky: chargeMoney (Stripe live) ────────────────────────────────────────
const ChargeInput = z.object({
  amount: z.number().int().positive(),
  currency: z.string().default("usd"),
  customerId: z.string().min(1),
  description: z.string().optional(),
});

export const chargeMoney = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChargeInput.parse(input))
  .handler(async ({ data }): Promise<ToolResult> => {
    try {
      const { createStripeClient } = await import("@/lib/stripe.server");
      const stripe = createStripeClient("live");
      const intent = await stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency,
        customer: data.customerId,
        description: data.description,
      });
      return { ok: true, data: { id: intent.id, status: intent.status }, message: `PaymentIntent ${intent.id}: ${intent.status}` };
    } catch (err) {
      const { getStripeErrorMessage } = await import("@/lib/stripe.server");
      return { ok: false, message: getStripeErrorMessage(err) };
    }
  });

// ── Risky: updateRow / deleteRow (allowlist + admin client) ─────────────────
const ALLOWED_TABLES = ["apps", "qa_runs", "notification_campaigns"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

const UpdateInput = z.object({
  table: z.enum(ALLOWED_TABLES),
  id: z.string().min(1),
  patch: z.record(z.string(), z.unknown()),
});

export const updateRow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data }): Promise<ToolResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error, data: row } = await (supabaseAdmin
        .from(data.table as AllowedTable) as any)
        .update(data.patch)
        .eq("id", data.id)
        .select()
        .maybeSingle();
      if (error) return { ok: false, message: error.message };
      return { ok: true, data: row, message: `Updated ${data.table}/${data.id}.` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

const DeleteInput = z.object({
  table: z.enum(ALLOWED_TABLES),
  id: z.string().min(1),
});

export const deleteRow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data }): Promise<ToolResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from(data.table as AllowedTable)
        .delete()
        .eq("id", data.id);
      if (error) return { ok: false, message: error.message };
      return { ok: true, message: `Deleted ${data.table}/${data.id}.` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  });
