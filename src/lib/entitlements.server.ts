// Server-only plan + usage enforcement. The single source of truth for
// "may this user start a paid action?". Never trust the browser for this.
import { FREE_RUN_LIMIT, PLAN_ERROR_PREFIX } from "@/lib/plan";

export type UsageKind = "qa_run" | "agent_task";

export type Plan = {
  isOwner: boolean;
  isSubscribed: boolean;
  runsUsed: number;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getPlan(userId: string): Promise<Plan> {
  const db = await admin();
  const [rolesRes, subRes, usageRes] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", userId),
    db
      .from("subscriptions")
      .select("status,current_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
    db.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const roles = (rolesRes.data ?? []).map((r) => r.role as string);
  const sub = subRes.data;
  const isSubscribed =
    !!sub &&
    ["active", "trialing", "past_due"].includes(sub.status) &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
  return {
    isOwner: roles.includes("owner") || roles.includes("admin"),
    isSubscribed,
    runsUsed: usageRes.count ?? 0,
  };
}

/** Pure rule, unit-tested: free users get FREE_RUN_LIMIT total runs. */
export function canStartRun(p: Plan): boolean {
  return p.isOwner || p.isSubscribed || p.runsUsed < FREE_RUN_LIMIT;
}

export class PlanError extends Error {
  constructor() {
    super(`${PLAN_ERROR_PREFIX} Free run limit reached (${FREE_RUN_LIMIT} runs). Upgrade to Pro for unlimited runs.`);
  }
}

/**
 * Charge one run on the server. `ref` makes it idempotent (same task/run is
 * charged once). Throws PlanError when the free limit is used up.
 * Returns the usage_event id (null when the same ref was already charged).
 */
export async function chargeRun(
  userId: string,
  kind: UsageKind,
  ref: string,
): Promise<string | null> {
  const db = await admin();
  const existing = await db
    .from("usage_events")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("meta->>ref", ref)
    .maybeSingle();
  if (existing.data) return null;

  const plan = await getPlan(userId);
  if (!canStartRun(plan)) throw new PlanError();

  const { data, error } = await db
    .from("usage_events")
    .insert({ user_id: userId, kind, meta: { ref } })
    .select("id")
    .single();
  if (error) {
    // Unique (user, kind, ref) race: someone else already charged it.
    if (error.code === "23505") return null;
    throw new Error(error.message);
  }
  return data.id;
}

export async function refundRun(eventId: string | null | undefined) {
  if (!eventId) return;
  const db = await admin();
  await db.from("usage_events").delete().eq("id", eventId);
}

/** For AI helpers inside an already-charged run/task: signed-in + not over the free limit. */
export async function requireEntitled(userId: string) {
  const plan = await getPlan(userId);
  if (plan.isOwner || plan.isSubscribed || plan.runsUsed <= FREE_RUN_LIMIT) return plan;
  throw new PlanError();
}
