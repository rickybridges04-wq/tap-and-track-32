import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { getAutomatedRun, getRunRegression } from "@/lib/qa/projects.functions";
import { CreateBugDialog } from "@/components/CreateBugDialog";
import { verdictColor, verdictLabel } from "@/lib/qa/scoring";
import { DIFF_CLASS, DIFF_LABEL, type DiffState } from "@/lib/qa/regression";



export const Route = createFileRoute("/qa/automated/$runId")({
  head: () => ({
    meta: [
      { title: "Automated run · Synapse QA OS" },
      {
        name: "description",
        content:
          "Real browser results for each automated test case: pass/fail, failing step, console errors, network failures, accessibility violations and web vitals.",
      },
      { property: "og:title", content: "Automated run · Synapse QA OS" },
      {
        property: "og:description",
        content: "Evidence-backed automated test results from a real browser run.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomatedRun,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-destructive">Could not load this run: {error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Run not found.</p>
    </AppShell>
  ),
});

type Vitals = { lcp_ms?: number | null; cls?: number | null; ttfb_ms?: number | null; fcp_ms?: number | null };

function AutomatedRun() {
  const { runId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["qa-automated-run", runId],
    queryFn: () => getAutomatedRun({ data: { id: runId } }),
    // Realtime drives updates; this slow poll is the fallback.
    refetchInterval: (q) => {
      const d = q.state.data as { run?: { status?: string } } | null | undefined;
      return d?.run && d.run.status !== "completed" && d.run.status !== "failed" ? 8000 : false;
    },
  });
  const live = data?.run && data.run.status !== "completed" && data.run.status !== "failed";

  const { data: regression } = useQuery({
    queryKey: ["qa-run-regression", runId],
    queryFn: () => getRunRegression({ data: { id: runId } }),
    enabled: data?.run?.status === "completed",
  });

  // Realtime: jobs and results for this run. RLS still applies.
  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ["qa-automated-run", runId] });
    const channel = supabase
      .channel(`qa-run-${runId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_jobs", filter: `run_id=eq.${runId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automated_results", filter: `run_id=eq.${runId}` },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [runId, qc]);

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Run not found.</p>
      </AppShell>
    );
  }

  const { run, jobs, results, cases, screenshots, analyses } = data;
  const resultByJob = new Map(results.map((r) => [r.job_id, r]));
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const analysisBySignature = new Map((analyses ?? []).map((a) => [a.error_signature, a]));

  // Group real failures by signature — several failures often share one root cause.
  const failures = results.filter((r) => r.status === "fail");
  const groups = new Map<string, typeof failures>();
  for (const r of failures) {
    const key = r.error_signature ?? `no-signature:${r.id}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const infraErrors = results.filter((r) => r.status === "error");

  // Live counters
  const total = jobs.length;
  const passing = results.filter((r) => r.status === "pass").length;
  const failing = failures.length;
  const errors = infraErrors.length;
  const done = results.length;
  const queued = jobs.filter((j) => j.status === "queued").length;
  const running = jobs.filter((j) => j.status === "claimed").length;
  const feed = [...results]
    .map((r) => ({ ...r, code: caseById.get(r.case_id)?.code ?? "—" }))
    .reverse();

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            RUN #{run.id.slice(0, 8)} ·{" "}
            {run.status === "completed" ? "Complete" : running > 0 ? "Running" : run.status}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.target_url} · {new Date(run.created_at).toLocaleString()} · {jobs.length} case(s)
          </p>
        </div>
        <div className="flex items-end gap-4">
          <Button asChild variant="outline">
            <Link to="/qa/report/$runId" params={{ runId }}>
              View report
            </Link>
          </Button>
          {run.status === "completed" && run.score != null && run.verdict && (
            <div className="text-right">
              <div className="text-3xl font-semibold">{run.score}</div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${verdictColor(
                  run.verdict as "ready" | "minor" | "major" | "block",
                )}`}
              >
                {verdictLabel(run.verdict as "ready" | "minor" | "major" | "block")}
              </span>
              <div className="mt-1 text-xs text-muted-foreground">
                {run.passed_count ?? 0} pass · {run.failed_count ?? 0} fail
              </div>
            </div>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {done}/{total} settled
          </CardTitle>
          <CardDescription>
            {passing} passing · {failing} failing · {errors} error{errors === 1 ? "" : "s"} ·{" "}
            {queued} queued{running > 0 ? ` · ${running} running` : ""}
            {live ? " · live" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={total ? Math.round((done / total) * 100) : 0} />
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {suiteCounters(jobs, results, cases).map((s) => (
              <span key={s.label} className="rounded-full bg-muted px-2 py-0.5">
                {s.label} {s.done}/{s.total}
              </span>
            ))}
          </div>
          {feed.length > 0 && (
            <div className="space-y-0.5 text-xs">
              {feed.slice(0, 12).map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${stateClass(r.status)}`}>
                    {stateLabel(r.status)}
                  </span>
                  <span className="font-mono">{r.code}</span>
                  <span className="text-muted-foreground">
                    {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {regression && regression.diff.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Regression diff</CardTitle>
            <CardDescription>
              {regression.previous_run_id
                ? `Compared with run #${regression.previous_run_id.slice(0, 8)}.`
                : "First completed automated run for this project."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {regression.diff.map((d) => (
              <div key={d.case_id} className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DIFF_CLASS[d.state as DiffState]}`}
                >
                  {DIFF_LABEL[d.state as DiffState]}
                </span>
                {d.flaky && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                    Flaky
                  </span>
                )}
                <span className="font-mono text-xs">{d.code}</span>
                <span className="text-muted-foreground">{d.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {run.status !== "completed" && (
        <p className="mb-4 text-sm text-muted-foreground">
          {run.progress_stage ?? run.status} — results appear as the browser worker reports them.
        </p>
      )}


      {groups.size > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold">
            Failure groups · {failures.length} failure{failures.length === 1 ? "" : "s"} ·{" "}
            {groups.size} root cause{groups.size === 1 ? "" : "s"}
          </h2>
          <div className="mt-3 space-y-3">
            {Array.from(groups.entries()).map(([key, group]) => {
              const first = group[0];
              const analysis = first.error_signature
                ? analysisBySignature.get(first.error_signature)
                : undefined;
              const steps = Array.isArray(analysis?.repro_steps)
                ? (analysis!.repro_steps as string[])
                : [];
              const tc = caseById.get(first.case_id);
              const consoleErrors = (first.console_errors ?? []) as string[];
              const network = (first.network_failures ?? []) as Array<{
                url: string;
                status: number | null;
                method: string;
                failure: string | null;
              }>;
              return (
                <Card key={key} className="border-destructive/40">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="text-base">
                        {group.length} failure{group.length === 1 ? "" : "s"} · 1 root cause
                      </CardTitle>
                      <CardDescription className="break-words">
                        {group
                          .map((g) => caseById.get(g.case_id)?.code ?? "case")
                          .join(", ")}{" "}
                        · step {first.failed_step_index ?? "?"} ·{" "}
                        {first.error_message ?? "no message"}
                      </CardDescription>
                    </div>
                    <CreateBugDialog
                      draft={{
                        title:
                          analysis?.likely_cause?.split(/[.\n]/)[0]?.slice(0, 120) ||
                          `${tc?.code ?? "Test"} fails at step ${first.failed_step_index ?? 0}`,
                        severity: (analysis?.suggested_severity ?? "high") as
                          | "low"
                          | "medium"
                          | "high"
                          | "critical",
                        steps: steps.length ? steps : [`Run test case ${tc?.code ?? ""} against ${run.target_url}`],
                        expected: tc?.title ? `${tc.title} should succeed.` : "",
                        actual: first.error_message ?? "The test failed.",
                        likelyCause: analysis?.likely_cause ?? "",
                        projectId: (run.project_id as string | null) ?? null,
                        resultId: first.id,
                        analysisId: analysis?.id ?? null,
                        screenshotPath: first.screenshot_path,
                      }}
                    />
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {analysis ? (
                      <div className="rounded-md border border-border bg-muted/40 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-600">
                            Suggestion — AI
                          </span>
                          <span>
                            suggested {analysis.suggested_severity ?? "—"} · confidence{" "}
                            {analysis.confidence != null ? `${Math.round(analysis.confidence * 100)}%` : "—"}
                          </span>
                          <span>· seen {analysis.occurrences}×</span>
                        </div>
                        <p className="mt-2">{analysis.likely_cause}</p>
                        {steps.length > 0 && (
                          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs">
                            {steps.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ol>
                        )}
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          The browser decided this failure. This explanation is a suggestion and does not
                          change the result.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No AI explanation stored for this failure.
                      </p>
                    )}

                    {consoleErrors.length > 0 && (
                      <Section title={`Console errors (${consoleErrors.length})`}>
                        <ul className="list-disc space-y-0.5 pl-5 text-xs">
                          {consoleErrors.slice(0, 10).map((c, i) => (
                            <li key={i} className="break-words">{c}</li>
                          ))}
                        </ul>
                      </Section>
                    )}
                    {network.length > 0 && (
                      <Section title={`Network failures (${network.length})`}>
                        <ul className="space-y-0.5 text-xs">
                          {network.slice(0, 10).map((n, i) => (
                            <li key={i} className="break-words">
                              {n.method} {n.url} — {n.status ?? n.failure ?? "failed"}
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}
                    {screenshots[first.id] && (
                      <Section title="Screenshot">
                        <img
                          src={screenshots[first.id]}
                          alt={`Screenshot from the failing test case ${tc?.code ?? ""}`}
                          className="max-h-80 rounded-md border border-border"
                        />
                      </Section>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {infraErrors.length > 0 && (
        <p className="mb-6 rounded-md border border-orange-500/40 bg-orange-500/5 p-3 text-sm">
          {infraErrors.length} case{infraErrors.length === 1 ? "" : "s"} ended in an infrastructure
          error, re-run. These are not analysed.
        </p>
      )}


      <div className="space-y-3">
        {jobs.map((job) => {
          const result = resultByJob.get(job.id);
          const tc = caseById.get(job.case_id);
          const state = result
            ? result.status
            : job.status === "claimed"
              ? "running"
              : job.status === "failed"
                ? "error"
                : "queued";
          const vitals = (result?.web_vitals ?? {}) as Vitals;
          const consoleErrors = (result?.console_errors ?? []) as string[];
          const network = (result?.network_failures ?? []) as Array<{
            url: string;
            status: number | null;
            method: string;
            failure: string | null;
          }>;
          const axe = (result?.axe_violations ?? []) as Array<{
            id: string;
            impact: string | null;
            help: string;
            nodes: number;
          }>;

          return (
            <Card key={job.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    <span className="font-mono text-sm">{tc?.code ?? "—"}</span> {tc?.title ?? ""}
                  </CardTitle>
                  <CardDescription>
                    {result?.duration_ms != null ? `${result.duration_ms} ms` : "—"}
                    {job.attempts > 1 ? ` · attempt ${job.attempts}` : ""}
                  </CardDescription>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stateClass(state)}`}>
                  {stateLabel(state)}
                </span>
              </CardHeader>
              {result && (
                <CardContent className="space-y-3 text-sm">
                  {result.status !== "pass" && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Failure
                      </div>
                      <div className="mt-1">
                        {result.failed_step_index != null
                          ? `Step ${result.failed_step_index}: `
                          : ""}
                        {result.error_message ?? "No message reported."}
                      </div>
                    </div>
                  )}

                  {consoleErrors.length > 0 && (
                    <Section title={`Console errors (${consoleErrors.length})`}>
                      <ul className="list-disc space-y-0.5 pl-5 text-xs">
                        {consoleErrors.slice(0, 20).map((c, i) => (
                          <li key={i} className="break-words">{c}</li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {network.length > 0 && (
                    <Section title={`Network failures (${network.length})`}>
                      <ul className="space-y-0.5 text-xs">
                        {network.slice(0, 20).map((n, i) => (
                          <li key={i} className="break-words">
                            {n.method} {n.url} — {n.status ?? n.failure ?? "failed"}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {axe.length > 0 && (
                    <Section title={`Accessibility violations (${axe.length})`}>
                      <ul className="space-y-0.5 text-xs">
                        {axe.slice(0, 20).map((a, i) => (
                          <li key={i}>
                            <span className="font-mono">{a.id}</span> · {a.impact ?? "unknown"} ·{" "}
                            {a.nodes} element(s) — {a.help}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  <Section title="Web vitals">
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>LCP {fmt(vitals.lcp_ms, "ms")}</span>
                      <span>CLS {vitals.cls != null ? vitals.cls.toFixed(3) : "—"}</span>
                      <span>TTFB {fmt(vitals.ttfb_ms, "ms")}</span>
                      <span>FCP {fmt(vitals.fcp_ms, "ms")}</span>
                    </div>
                  </Section>

                  {screenshots[result.id] && (
                    <Section title="Screenshot">
                      <img
                        src={screenshots[result.id]}
                        alt={`Screenshot from test case ${tc?.code ?? ""}`}
                        className="max-h-96 rounded-md border border-border"
                      />
                    </Section>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function fmt(v: number | null | undefined, unit: string) {
  return v == null ? "—" : `${Math.round(v)}${unit}`;
}

function stateLabel(state: string) {
  return state === "pass"
    ? "Pass"
    : state === "fail"
      ? "Fail"
      : state === "error"
        ? "Error"
        : state === "running"
          ? "Running"
          : "Queued";
}

function stateClass(state: string) {
  if (state === "pass") return "bg-emerald-500/15 text-emerald-600";
  if (state === "fail") return "bg-rose-500/15 text-rose-600";
  if (state === "error") return "bg-orange-500/15 text-orange-600";
  if (state === "running") return "bg-blue-500/15 text-blue-600";
  return "bg-muted text-muted-foreground";
}
