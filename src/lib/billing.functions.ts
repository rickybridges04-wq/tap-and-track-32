// Billing server functions (CHECKOUT-MIG-01). Prices come from BAE HQ → Pricing via the gateway.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CatalogPlan } from "@/lib/billing.server";

export type { CatalogPlan };

const planKey = z.string().regex(/^[a-z0-9_-]{2,80}$/);
// The browser's own origin, used only to build its return addresses.
const origin = z
  .string()
  .url()
  .refine((u) => {
    const x = new URL(u);
    return x.protocol === "https:" && (x.pathname === "/" || x.pathname === "") && !x.search;
  }, "origin must be an https origin")
  .transform((u) => new URL(u).origin);

/** Public: the paid plans as set in BAE HQ → Pricing (cheapest first). */
export const getPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogPlan[]> => {
    const { fetchCatalog, paidPlans } = await import("@/lib/billing.server");
    return paidPlans(await fetchCatalog());
  },
);

export const startPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ planKey, origin }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      const { getPlan } = await import("@/lib/entitlements.server");
      const plan = await getPlan(context.userId);
      if (plan.isSubscribed)
        return { error: "You already have an active plan. Use Manage billing to change it." };
      const { startCheckout } = await import("@/lib/billing.server");
      return { url: await startCheckout(context.userId, data.planKey, data.origin) };
    } catch (e) {
      console.error("startPlanCheckout:", (e as Error).message);
      return { error: "Checkout could not start. Please try again in a moment." };
    }
  });

/** After Stripe sends the buyer back with ?session_id=… — grants the plan (idempotent). */
export const confirmPlanCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().regex(/^cs_[A-Za-z0-9_]{8,250}$/) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ planKey: string | null } | { error: string }> => {
    try {
      const { confirmCheckout } = await import("@/lib/billing.server");
      const bal = await confirmCheckout(context.userId, data.sessionId);
      return { planKey: bal.plan_key ?? null };
    } catch (e) {
      console.error("confirmPlanCheckout:", (e as Error).message);
      return {
        error:
          "We couldn't confirm the payment yet. Refresh in a minute; you won't be charged twice.",
      };
    }
  });

export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ origin }).parse(d))
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      const { portalUrl } = await import("@/lib/billing.server");
      return { url: await portalUrl(context.userId, data.origin) };
    } catch (e) {
      console.error("openBillingPortal:", (e as Error).message);
      return { error: "Billing portal is unavailable right now." };
    }
  });
