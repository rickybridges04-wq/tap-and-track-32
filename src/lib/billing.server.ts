// Billing through the BAE AI Gateway (CHECKOUT-MIG-01, 2026-11-26). Server-only.
//
// Prices and plans live in BAE HQ → Pricing (gateway billing_plans); this app hard-codes
// no price. Checkout, renewals and cancellation are Stripe on the gateway's account
// (v1-credits: subscribe / confirm / balance / portal) — the same live path verified with
// a real purchase + refund in The Forge on 2026-11-25.
//
// The app's own `subscriptions` table stays the place entitlements.server.ts reads, so
// plan limits keep working unchanged. A gateway-sourced row is marked by
// stripe_subscription_id = "gateway:<plan_key>" and stripe_customer_id = null.
import { gatewayCredits } from "@/lib/ai-proxy.server";

export const GATEWAY_SUB_PREFIX = "gateway:";

export type CatalogPlan = {
  plan_key: string;
  name: string;
  price_cents: number;
  billing_interval: string | null;
  included_credits: number;
};
export type Catalog = { plans: CatalogPlan[]; packs: unknown[]; signup_free_credits: number };

export type GatewayBalance = {
  plan_key: string | null;
  plan_period_end: string | null;
  total_credits?: number;
  error?: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function ok<T>(res: { status: number; body: unknown }, what: string): T {
  if (res.status < 200 || res.status >= 300) {
    const msg = (res.body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new Error(`Billing ${what} failed: ${msg}`);
  }
  return res.body as T;
}

export async function fetchCatalog(): Promise<Catalog> {
  return ok<Catalog>(await gatewayCredits({ action: "catalog" }), "catalog");
}

/** Paid plans only, cheapest first. */
export function paidPlans(c: Catalog): CatalogPlan[] {
  return (c.plans ?? [])
    .filter((p) => p.price_cents > 0)
    .sort((a, b) => a.price_cents - b.price_cents);
}

export async function startCheckout(
  userId: string,
  planKey: string,
  origin: string,
): Promise<string> {
  const catalog = await fetchCatalog();
  if (!paidPlans(catalog).some((p) => p.plan_key === planKey)) throw new Error("Unknown plan");
  ok(await gatewayCredits({ action: "ensure", external_user_id: userId }), "setup");
  const body = ok<{ checkout_url?: string }>(
    await gatewayCredits({
      action: "subscribe",
      external_user_id: userId,
      plan_key: planKey,
      success_url: `${origin}/upgrade?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/upgrade`,
    }),
    "checkout",
  );
  if (!body.checkout_url?.startsWith("https://"))
    throw new Error("Billing checkout failed: no checkout link");
  return body.checkout_url;
}

/** Copy the gateway's view of this user's plan into the local subscriptions row. */
export async function mirrorPlan(userId: string, bal: GatewayBalance): Promise<void> {
  const db = await admin();
  const { data: existing } = await db
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  const isGatewayRow =
    !existing || String(existing.stripe_subscription_id ?? "").startsWith(GATEWAY_SUB_PREFIX);

  if (bal.plan_key) {
    // Never overwrite a still-active legacy Stripe subscriber with a gateway row.
    if (!isGatewayRow && ["active", "trialing", "past_due"].includes(String(existing?.status)))
      return;
    let priceCents: number | null = null;
    try {
      priceCents =
        paidPlans(await fetchCatalog()).find((p) => p.plan_key === bal.plan_key)?.price_cents ??
        null;
    } catch {
      /* price is display-only */
    }
    const { error } = await db.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: null,
        stripe_subscription_id: `${GATEWAY_SUB_PREFIX}${bal.plan_key}`,
        status: "active",
        price_cents: priceCents,
        current_period_end: bal.plan_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`Could not record plan: ${error.message}`);
  } else if (existing && isGatewayRow) {
    await db
      .from("subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }
}

export async function confirmCheckout(userId: string, sessionId: string): Promise<GatewayBalance> {
  const bal = ok<GatewayBalance>(
    await gatewayCredits({ action: "confirm", external_user_id: userId, session_id: sessionId }),
    "confirm",
  );
  await mirrorPlan(userId, bal);
  return bal;
}

/** Ask the gateway for the current plan (it renews lazily from Stripe) and mirror it. */
export async function syncPlan(userId: string): Promise<GatewayBalance | null> {
  const res = await gatewayCredits({ action: "balance", external_user_id: userId });
  if (res.status === 404) return null; // no gateway record yet = never bought
  const bal = ok<GatewayBalance>(res, "sync");
  await mirrorPlan(userId, bal);
  return bal;
}

export async function portalUrl(userId: string, origin: string): Promise<string> {
  const body = ok<{ url?: string }>(
    await gatewayCredits({
      action: "portal",
      external_user_id: userId,
      return_url: `${origin}/upgrade`,
    }),
    "portal",
  );
  if (!body.url?.startsWith("https://")) throw new Error("Billing portal unavailable");
  return body.url;
}
