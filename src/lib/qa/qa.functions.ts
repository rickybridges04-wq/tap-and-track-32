// Synapse QA OS — server-side persistence for runs, pages, findings.
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
};

// -------- create --------
const CreateInput = z.object({
  url: z.string().url(),
  depth: z.enum(["quick", "standard", "deep"]),
  personas: z.array(z.string()).min(1),
});

export const createRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("qa_runs")
      .insert({
        user_id: userId,
        target_url: data.url,
        depth: data.depth,
        personas: data.personas,
        status: "pending",
        progress_pct: 0,
        progress_stage: "Queued",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

// -------- progress patch --------
const PatchInput = z.object({
  id: z.string().uuid(),
  status: z.string().optional(),
  progress_pct: z.number().int().min(0).max(100).optional(),
  progress_stage: z.string().optional(),
  score: z.number().int().nullable().optional(),
  verdict: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  warnings: z.array(z.string()).optional(),
  completed_at: z.string().nullable().optional(),
});

export const patchRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PatchInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("qa_runs")
      .update(rest)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- pages --------
const AddPageInput = z.object({
  run_id: z.string().uuid(),
  url: z.string(),
  title: z.string().optional().nullable(),
  status: z.number().int().optional().nullable(),
  links: z.array(z.string()).default([]),
  markdown_preview: z.string().optional().nullable(),
});

export const addPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AddPageInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("qa_pages").insert({
      user_id: userId,
      run_id: data.run_id,
      url: data.url,
      title: data.title ?? null,
      status: data.status ?? null,
      links: data.links,
      markdown_preview: data.markdown_preview ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- findings --------
const AddFindingsInput = z.object({
  run_id: z.string().uuid(),
  findings: z.array(
    z.object({
      persona_id: z.string(),
      page_url: z.string(),
      category: z.enum(CATEGORY),
      severity: z.enum(SEVERITY),
      confidence: z.number(),
      title: z.string(),
      detail: z.string(),
      suggestion: z.string().optional().nullable(),
    }),
  ),
});

export const addFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AddFindingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.findings.length === 0) return { ok: true };
    const rows = data.findings.map((f) => ({
      user_id: userId,
      run_id: data.run_id,
      persona_id: f.persona_id,
      page_url: f.page_url,
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      title: f.title,
      detail: f.detail,
      suggestion: f.suggestion ?? null,
    }));
    const { error } = await supabase.from("qa_findings").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- reads --------
export const listRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QaRunRow[]> => {
    const { supabase, userId } = context;
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

