// Dashboard aggregates — read straight from the database, never browser storage.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardRecentRun = {
  id: string;
  target_url: string;
  status: string;
  score: number | null;
  verdict: string | null;
  depth: string;
  personas: string[];
  created_at: string;
  findings: number;
};

export type DashboardData = {
  apps: number;
  runs: number;
  pages: number;
  findings: number;
  openHighSeverity: number;
  recent: DashboardRecentRun[];
};

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardData> => {
    const { supabase, userId } = context;

    const [appsRes, runsRes, pagesRes, findingsRes, highRes, recentRes] = await Promise.all([
      supabase.from("apps").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("qa_runs").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("qa_pages").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("qa_findings").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("qa_findings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("severity", ["critical", "high"]),
      supabase
        .from("qa_runs")
        .select("id,target_url,status,score,verdict,depth,personas,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const recentRows = recentRes.data ?? [];

    // Per-run finding counts, so each row shows real numbers rather than a dash.
    const counts = await Promise.all(
      recentRows.map(async (r) => {
        const { count } = await supabase
          .from("qa_findings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("run_id", r.id as string);
        return count ?? 0;
      }),
    );

    return {
      apps: appsRes.count ?? 0,
      runs: runsRes.count ?? 0,
      pages: pagesRes.count ?? 0,
      findings: findingsRes.count ?? 0,
      openHighSeverity: highRes.count ?? 0,
      recent: recentRows.map((r, i) => ({
        id: r.id as string,
        target_url: r.target_url as string,
        status: r.status as string,
        score: (r.score ?? null) as number | null,
        verdict: (r.verdict ?? null) as string | null,
        depth: r.depth as string,
        personas: (r.personas ?? []) as string[],
        created_at: r.created_at as string,
        findings: counts[i] ?? 0,
      })),
    };
  });
