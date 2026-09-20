// Shared queueing for automated runs: used by the in-app button and the public API.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type QueueResult = { run_id: string; jobs_queued: number };

export async function queueAutomatedRun(
  client: Client,
  userId: string,
  projectId: string,
  meta: { ref?: string | null; commit_sha?: string | null } = {},
): Promise<QueueResult> {
  const { data: project, error: pErr } = await client
    .from("qa_projects")
    .select("id, base_url")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!project) throw new Error("Project not found");

  const { data: cases, error: cErr } = await client
    .from("test_cases")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (cErr) throw new Error(cErr.message);
  if (!cases || cases.length === 0) throw new Error("This project has no test cases yet");

  const { data: run, error: rErr } = await client
    .from("qa_runs")
    .insert({
      user_id: userId,
      project_id: projectId,
      kind: "automated",
      target_url: project.base_url,
      depth: "automated",
      personas: [],
      status: "queued",
      progress_pct: 0,
      progress_stage: `Queued ${cases.length} test case${cases.length === 1 ? "" : "s"}`,
      ref: meta.ref ?? null,
      commit_sha: meta.commit_sha ?? null,
    })
    .select("id")
    .single();
  if (rErr) throw new Error(rErr.message);

  const { error: jErr } = await client
    .from("qa_jobs")
    .insert(cases.map((c) => ({ user_id: userId, run_id: run.id, case_id: c.id })));
  if (jErr) throw new Error(jErr.message);

  await dispatchWorker();
  return { run_id: run.id as string, jobs_queued: cases.length };
}

/** Nudge the external Playwright worker repo. Never allowed to fail a run. */
export async function dispatchWorker(): Promise<{ dispatched: boolean; reason?: string }> {
  const token = process.env["QA_WORKER_DISPATCH_TOKEN"];
  const repo = process.env["QA_WORKER_REPO"];
  if (!token || !repo) return { dispatched: false, reason: "dispatch not configured" };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: "qa-jobs-queued" }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`worker dispatch failed [${res.status}]: ${body}`);
      return { dispatched: false, reason: `github ${res.status}` };
    }
    return { dispatched: true };
  } catch (e) {
    console.error("worker dispatch error:", e);
    return { dispatched: false, reason: "network error" };
  }
}
