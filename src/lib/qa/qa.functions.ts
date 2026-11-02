// Walkthrough Wizard QAOS — server-side persistence for runs, pages, findings.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SEVERITY = ["critical", "high", "medium", "low"] as const;
const CATEGORY = ["functional", "visual", "accessibility", "performance"] as const;

export type QaRunRow = {
  id: string;
  target_url: string;
  depth: "quick" | "standard" | "deep";
  personas: string[];
  status: string;
  progress_pct: number;
  progress_stage: string | null;
  score: number | null;
  verdict: string | null;
  error: string | null;
  warnings: string[];
  pages_discovered: number | null;
  pages_scraped: number | null;
  created_at: string;
  completed_at: string | null;
};

export type QaPageRow = {
  id: string;
  run_id: string;
  url: string;
  title: string | null;
  status: number | null;
  links: string[];
  markdown_preview: string | null;
  screenshot_url: string | null;
  latency_ms: number | null;
  truncated: boolean;
};

export type QaFindingRow = {
  id: string;
  run_id: string;
  persona_id: string;
  page_url: string;
  category: (typeof CATEGORY)[number];
  severity: (typeof SEVERITY)[number];
  confidence: number;
  title: string;
  detail: string;
  suggestion: string | null;
  basis: "observed" | "inferred";
};

// -------- create --------
const CreateInput = z.object({
  url: z.string().url(),
  depth: z.enum(["quick", "standard", "deep"]),
  personas: z.array(z.string()).min(1),
});

export type CreateRunResult = { ok: true; id: string } | { ok: false; planError: string };

export const createRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }): Promise<CreateRunResult> => {
    const { supabase, userId } = context;
    const { chargeRun, refundRun, PlanError } = await import("@/lib/entitlements.server");
    const { wakeRun, wakeUrlFor } = await import("@/lib/qa/engine.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const id = crypto.randomUUID();

    // Charge on the server when the run starts. Free = 3 runs total.
    let usageEventId: string | null;
    try {
      usageEventId = await chargeRun(userId, "qa_run", id);
    } catch (err) {
      if (err instanceof PlanError) return { ok: false, planError: err.message };
      throw err;
    }

    const { error } = await supabase.from("qa_runs").insert({
      id,
      user_id: userId,
      target_url: data.url,
      depth: data.depth,
      personas: data.personas,
      status: "pending",
      progress_pct: 0,
      progress_stage: "Queued",
      usage_event_id: usageEventId,
      wake_url: wakeUrlFor(getRequest().url),
    });
    if (error) {
      await refundRun(usageEventId); // failed to start → not counted
      throw new Error(error.message);
    }
    await wakeRun(id); // background engine picks it up; tab can close
    return { ok: true, id };
  });

/** While the run page is open, nudge the engine (covers a dropped wake-up). */
export const nudgeRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase
      .from("qa_runs")
      .select("id,status,lease_until")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!own || own.status === "completed" || own.status === "failed") return { more: false };
    if (own.lease_until && new Date(own.lease_until) > new Date()) return { more: true };
    const { advanceRun } = await import("@/lib/qa/engine.server");
    return { more: await advanceRun(data.id) };
  });

// -------- reads --------
export const listRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QaRunRow[]> => {
    const { supabase, userId } = context;
    // Runs execute on the server. If one makes no progress for 10 minutes the
    // background engine lost it — mark it failed instead of leaving it stuck.
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from("qa_runs")
      .update({
        status: "failed",
        error: "Run stalled — the background engine made no progress for 10 minutes.",
        progress_stage: "Interrupted",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .not("status", "in", "(completed,failed)")
      .lt("updated_at", cutoff);

    const { data, error } = await supabase
      .from("qa_runs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as QaRunRow[];
  });

const GetInput = z.object({ id: z.string().uuid() });

export const getRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [runRes, pagesRes, findingsRes] = await Promise.all([
      supabase.from("qa_runs").select("*").eq("id", data.id).eq("user_id", userId).maybeSingle(),
      supabase.from("qa_pages").select("*").eq("run_id", data.id).eq("user_id", userId).order("created_at"),
      supabase.from("qa_findings").select("*").eq("run_id", data.id).eq("user_id", userId).order("created_at"),
    ]);
    if (runRes.error) throw new Error(runRes.error.message);
    if (!runRes.data) return null;
    return {
      run: runRes.data as unknown as QaRunRow,
      pages: (pagesRes.data ?? []) as unknown as QaPageRow[],
      findings: (findingsRes.data ?? []) as unknown as QaFindingRow[],
    };
  });

export const deleteRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("qa_runs").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAllRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("qa_runs").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

