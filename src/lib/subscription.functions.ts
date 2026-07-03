import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FREE_RUN_LIMIT = 3;

export type UsageState = {
  runsUsed: number;
  runsRemaining: number;
  isOwner: boolean;
  isSubscribed: boolean;
  canRun: boolean;
  email: string | null;
};

export const getUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageState> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [rolesRes, subRes, usageRes, userRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin
        .from("subscriptions")
        .select("status,current_period_end")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase.auth.getUser(),
    ]);

    const isOwner = (rolesRes.data ?? []).some((r: any) => r.role === "owner");
    const sub = subRes.data as any;
    const now = new Date();
    const isSubscribed =
      !!sub &&
      ["active", "trialing"].includes(sub.status) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > now);
    const runsUsed = usageRes.count ?? 0;
    const remaining = Math.max(0, FREE_RUN_LIMIT - runsUsed);
    const canRun = isOwner || isSubscribed || runsUsed < FREE_RUN_LIMIT;

    return {
      runsUsed,
      runsRemaining: remaining,
      isOwner,
      isSubscribed,
      canRun,
      email: userRes.data.user?.email ?? null,
    };
  });

export const recordRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: "qa_run" | "agent_task"; meta?: Record<string, unknown> }) => {
    if (data.kind !== "qa_run" && data.kind !== "agent_task") throw new Error("Invalid kind");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true; blocked?: false } | { ok: false; blocked: true; reason: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [rolesRes, subRes, usageRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin.from("subscriptions").select("status,current_period_end").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    const isOwner = (rolesRes.data ?? []).some((r: any) => r.role === "owner");
    const sub = subRes.data as any;
    const isSubscribed =
      !!sub && ["active", "trialing"].includes(sub.status) &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
    const runsUsed = usageRes.count ?? 0;

    if (!isOwner && !isSubscribed && runsUsed >= FREE_RUN_LIMIT) {
      return { ok: false, blocked: true, reason: "Free run limit reached. Upgrade to Pro." };
    }

    await supabaseAdmin.from("usage_events").insert({
      user_id: userId,
      kind: data.kind,
      meta: (data.meta as any) ?? null,
    });

    return { ok: true };
  });
