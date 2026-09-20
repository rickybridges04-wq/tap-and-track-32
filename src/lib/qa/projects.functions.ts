// Synapse QA OS — projects, suites, automated test cases, and automated runs.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { StepsSchema } from "@/lib/qa/steps";

export type QaProject = {
  id: string;
  name: string;
  base_url: string;
  environment: "staging" | "production";
  username: string | null;
  has_password: boolean;
  created_at: string;
};

export type TestSuite = {
  id: string;
  project_id: string;
  name: string;
  category: string;
  created_at: string;
};

export type TestCase = {
  id: string;
  suite_id: string;
  project_id: string;
  code: string;
  title: string;
  expected: string;
  steps_json: unknown;
  generated_by: "ai" | "human";
  created_at: string;
};

export type AutomatedResult = {
  id: string;
  run_id: string;
  case_id: string;
  job_id: string;
  status: "pass" | "fail" | "error";
  duration_ms: number | null;
  failed_step_index: number | null;
  error_message: string | null;
  console_errors: unknown;
  network_failures: unknown;
  axe_violations: unknown;
  web_vitals: unknown;
  step_log: unknown;
  screenshot_path: string | null;
  error_signature: string | null;
};

// ---------------- projects ----------------
const ProjectInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  base_url: z.string().url(),
  environment: z.enum(["staging", "production"]),
  username: z.string().max(200).nullable().optional(),
  password: z.string().max(200).nullable().optional(),
});

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QaProject[]> => {
    const { data, error } = await context.supabase
      .from("qa_projects")
      .select("id, name, base_url, environment, username, password, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      base_url: p.base_url,
      environment: p.environment as "staging" | "production",
      username: p.username,
      has_password: !!p.password,
      created_at: p.created_at,
    }));
  });

export const saveProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProjectInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const base = {
      name: data.name,
      base_url: data.base_url,
      environment: data.environment,
      username: data.username ?? null,
    };
    if (data.id) {
      // Only overwrite the stored password when a new one was typed.
      const patch = data.password ? { ...base, password: data.password } : base;
      const { error } = await supabase
        .from("qa_projects")
        .update(patch)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("qa_projects")
      .insert({ ...base, password: data.password ?? null, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const IdInput = z.object({ id: z.string().uuid() });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("qa_projects")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- suites + cases ----------------
const SuiteInput = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  category: z.enum(["auth", "crud", "security", "ui", "api", "a11y", "performance", "other"]),
});

export const saveSuite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuiteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("test_suites")
        .update({ name: data.name, category: data.category })
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("test_suites")
      .insert({
        user_id: userId,
        project_id: data.project_id,
        name: data.name,
        category: data.category,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteSuite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("test_suites")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CaseInput = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  suite_id: z.string().uuid(),
  code: z.string().min(1).max(40),
  title: z.string().min(1).max(300),
  expected: z.string().max(2000).default(""),
  steps_json: StepsSchema,
  generated_by: z.enum(["ai", "human"]).default("human"),
});

export const saveCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CaseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      suite_id: data.suite_id,
      project_id: data.project_id,
      code: data.code,
      title: data.title,
      expected: data.expected,
      steps_json: data.steps_json,
      generated_by: data.generated_by,
    };
    if (data.id) {
      const { error } = await supabase
        .from("test_cases")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("test_cases")
      .insert({ ...payload, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("test_cases")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- project detail ----------------
export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [projectRes, suitesRes, casesRes, runsRes] = await Promise.all([
      supabase
        .from("qa_projects")
        .select("id, name, base_url, environment, username, password, created_at")
        .eq("id", data.id)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("test_suites")
        .select("*")
        .eq("project_id", data.id)
        .eq("user_id", userId)
        .order("created_at"),
      supabase
        .from("test_cases")
        .select("*")
        .eq("project_id", data.id)
        .eq("user_id", userId)
        .order("code"),
      supabase
        .from("qa_runs")
        .select("id, kind, status, score, verdict, created_at, passed_count, failed_count, target_url")
        .eq("project_id", data.id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (projectRes.error) throw new Error(projectRes.error.message);
    if (!projectRes.data) return null;
    const p = projectRes.data;
    return {
      project: {
        id: p.id,
        name: p.name,
        base_url: p.base_url,
        environment: p.environment as "staging" | "production",
        username: p.username,
        has_password: !!p.password,
        created_at: p.created_at,
      } satisfies QaProject,
      suites: (suitesRes.data ?? []) as unknown as TestSuite[],
      cases: (casesRes.data ?? []) as unknown as TestCase[],
      runs: runsRes.data ?? [],
    };
  });

// ---------------- automated runs ----------------
export const startAutomatedRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ project_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: project, error: pErr } = await supabase
      .from("qa_projects")
      .select("id, base_url")
      .eq("id", data.project_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project) throw new Error("Project not found");

    const { data: cases, error: cErr } = await supabase
      .from("test_cases")
      .select("id")
      .eq("project_id", data.project_id)
      .eq("user_id", userId);
    if (cErr) throw new Error(cErr.message);
    if (!cases || cases.length === 0) throw new Error("This project has no test cases yet");

    const { data: run, error: rErr } = await supabase
      .from("qa_runs")
      .insert({
        user_id: userId,
        project_id: data.project_id,
        kind: "automated",
        target_url: project.base_url,
        depth: "automated",
        personas: [],
        status: "queued",
        progress_pct: 0,
        progress_stage: `Queued ${cases.length} test case${cases.length === 1 ? "" : "s"}`,
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    const { error: jErr } = await supabase.from("qa_jobs").insert(
      cases.map((c) => ({ user_id: userId, run_id: run.id, case_id: c.id })),
    );
    if (jErr) throw new Error(jErr.message);

    return { id: run.id as string, jobs: cases.length };
  });

export const getAutomatedRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [runRes, jobsRes, resultsRes] = await Promise.all([
      supabase.from("qa_runs").select("*").eq("id", data.id).eq("user_id", userId).maybeSingle(),
      supabase
        .from("qa_jobs")
        .select("id, case_id, status, claimed_by, attempts, error, created_at")
        .eq("run_id", data.id)
        .eq("user_id", userId)
        .order("created_at"),
      supabase
        .from("automated_results")
        .select("*")
        .eq("run_id", data.id)
        .eq("user_id", userId),
    ]);
    if (runRes.error) throw new Error(runRes.error.message);
    if (!runRes.data) return null;

    const caseIds = (jobsRes.data ?? []).map((j) => j.case_id);
    const { data: cases } = caseIds.length
      ? await supabase.from("test_cases").select("id, code, title, steps_json").in("id", caseIds)
      : { data: [] as Array<{ id: string; code: string; title: string; steps_json: unknown }> };

    // Signed URLs for the private evidence bucket.
    const results = (resultsRes.data ?? []) as unknown as AutomatedResult[];
    const signed: Record<string, string> = {};
    for (const r of results) {
      if (!r.screenshot_path) continue;
      const { data: url } = await supabase.storage
        .from("qa-evidence")
        .createSignedUrl(r.screenshot_path, 60 * 30);
      if (url?.signedUrl) signed[r.id] = url.signedUrl;
    }

    return {
      run: runRes.data,
      jobs: jobsRes.data ?? [],
      results,
      cases: cases ?? [],
      screenshots: signed,
    };
  });
