// Public API v1 handlers, shared by /api/v1/* and /api/public/v1/*.
import { z } from "zod";
import { authenticateApiKey } from "@/lib/qa/api-auth.server";
import { queueAutomatedRun } from "@/lib/qa/queue.server";
import { diffState, type CaseVerdict } from "@/lib/qa/regression";

const CreateBody = z.object({
  project_id: z.string().uuid(),
  kind: z.enum(["automated", "crawl"]).default("automated"),
  ref: z.string().max(200).optional(),
  commit_sha: z.string().max(80).optional(),
});

function baseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function handleCreateRun(request: Request): Promise<Response> {
  const caller = await authenticateApiKey(request);
  if (caller instanceof Response) return caller;

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await request.json());
  } catch (e) {
    return Response.json(
      { error: "Invalid body", detail: e instanceof Error ? e.message : "unparseable" },
      { status: 400 },
    );
  }

  if (body.kind === "crawl") {
    return Response.json(
      {
        error:
          "Crawl runs cannot be started through the API. A crawl is driven from the browser tab that owns the run; use kind=\"automated\", which the external Playwright worker executes headlessly.",
      },
      { status: 400 },
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { run_id, jobs_queued } = await queueAutomatedRun(
      supabaseAdmin,
      caller.userId,
      body.project_id,
      { ref: body.ref ?? null, commit_sha: body.commit_sha ?? null },
    );
    return Response.json(
      {
        run_id,
        jobs_queued,
        status_url: `${baseUrl(request)}/api/v1/runs/${run_id}`,
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not queue run";
    const status = /not found|no test cases/i.test(message) ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function handleGetRun(request: Request, runId: string): Promise<Response> {
  const caller = await authenticateApiKey(request);
  if (caller instanceof Response) return caller;
  if (!/^[0-9a-f-]{36}$/i.test(runId)) {
    return Response.json({ error: "Invalid run id" }, { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: run } = await supabaseAdmin
    .from("qa_runs")
    .select("id, kind, status, score, verdict, project_id, created_at, passed_count, failed_count")
    .eq("id", runId)
    .eq("user_id", caller.userId)
    .maybeSingle();
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });

  const [{ data: jobs }, { data: results }] = await Promise.all([
    supabaseAdmin.from("qa_jobs").select("id").eq("run_id", runId),
    supabaseAdmin.from("automated_results").select("case_id, status").eq("run_id", runId),
  ]);

  const rows = results ?? [];
  const passed = rows.filter((r) => r.status === "pass").length;
  const failed = rows.filter((r) => r.status === "fail").length;
  const errored = rows.filter((r) => r.status === "error").length;
  const total = jobs?.length ?? rows.length;

  // Newly failing vs the previous completed automated run of the same project.
  let newlyFailing: string[] = [];
  if (run.project_id) {
    const { data: prevRun } = await supabaseAdmin
      .from("qa_runs")
      .select("id")
      .eq("project_id", run.project_id)
      .eq("user_id", caller.userId)
      .eq("kind", "automated")
      .eq("status", "completed")
      .lt("created_at", run.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevRun) {
      const [{ data: prevResults }, { data: cases }] = await Promise.all([
        supabaseAdmin.from("automated_results").select("case_id, status").eq("run_id", prevRun.id),
        supabaseAdmin
          .from("test_cases")
          .select("id, code")
          .eq("project_id", run.project_id)
          .eq("user_id", caller.userId),
      ]);
      const prevBy = new Map((prevResults ?? []).map((r) => [r.case_id, r.status as CaseVerdict]));
      const curBy = new Map(rows.map((r) => [r.case_id, r.status as CaseVerdict]));
      newlyFailing = (cases ?? [])
        .filter(
          (c) =>
            prevBy.has(c.id) &&
            curBy.has(c.id) &&
            diffState(curBy.get(c.id)!, prevBy.get(c.id)!) === "newly_failing",
        )
        .map((c) => c.code);
    }
  }

  return Response.json({
    run_id: run.id,
    status: run.status,
    kind: run.kind,
    total,
    passed,
    failed,
    errored,
    pass_rate: total > 0 ? Math.round((passed / total) * 100) : 0,
    score: run.score,
    verdict: run.verdict,
    newly_failing: newlyFailing,
    report_url: `${baseUrl(request)}/qa/report/${run.id}`,
  });
}
