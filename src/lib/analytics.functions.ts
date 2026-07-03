import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnalyticsData = {
  totalUsers: number;
  activeSubs: number;
  mrr: number;
  runsLast30d: number;
  users: Array<{
    id: string;
    email: string;
    created_at: string;
    runs: number;
    plan: "owner" | "pro" | "free";
  }>;
};

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnalyticsData> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ownerRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!ownerRow) throw new Error("Forbidden");

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [profilesRes, subsRes, rolesRes, usageRes, runs30Res] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("subscriptions").select("user_id,status,price_cents,current_period_end"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("usage_events").select("user_id"),
      supabaseAdmin.from("usage_events").select("id", { count: "exact", head: true }).gte("created_at", since),
    ]);

    const runsByUser = new Map<string, number>();
    for (const r of (usageRes.data ?? []) as any[]) {
      runsByUser.set(r.user_id, (runsByUser.get(r.user_id) ?? 0) + 1);
    }
    const ownerSet = new Set<string>();
    for (const r of (rolesRes.data ?? []) as any[]) {
      if (r.role === "owner") ownerSet.add(r.user_id);
    }
    const subMap = new Map<string, any>();
    for (const s of (subsRes.data ?? []) as any[]) subMap.set(s.user_id, s);

    let activeSubs = 0;
    let mrrCents = 0;
    const now = new Date();
    for (const s of subMap.values()) {
      const active =
        ["active", "trialing"].includes(s.status) &&
        (!s.current_period_end || new Date(s.current_period_end) > now);
      if (active) {
        activeSubs++;
        mrrCents += s.price_cents ?? 0;
      }
    }

    const users = ((profilesRes.data ?? []) as any[]).map((p) => {
      const s = subMap.get(p.id);
      const active =
        s && ["active", "trialing"].includes(s.status) &&
        (!s.current_period_end || new Date(s.current_period_end) > now);
      const plan: "owner" | "pro" | "free" = ownerSet.has(p.id) ? "owner" : active ? "pro" : "free";
      return {
        id: p.id,
        email: p.email,
        created_at: p.created_at,
        runs: runsByUser.get(p.id) ?? 0,
        plan,
      };
    });

    return {
      totalUsers: (profilesRes.data ?? []).length,
      activeSubs,
      mrr: mrrCents / 100,
      runsLast30d: runs30Res.count ?? 0,
      users,
    };
  });
