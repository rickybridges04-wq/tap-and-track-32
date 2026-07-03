import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _admin: any = null;
function admin(): any {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

async function upsertSubscription(sub: any) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error("Webhook: missing userId in subscription metadata");
    return;
  }
  const item = sub.items?.data?.[0];
  const priceCents = item?.price?.unit_amount ?? null;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await admin().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_cents: priceCents,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

async function markCanceled(sub: any) {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  await admin()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

async function handle(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await markCanceled(event.data.object);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handle(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
