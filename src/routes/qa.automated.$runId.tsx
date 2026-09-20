import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAutomatedRun } from "@/lib/qa/projects.functions";
import { verdictColor, verdictLabel } from "@/lib/qa/scoring";

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
  const { data, isLoading } = useQuery({
    queryKey: ["qa-automated-run", runId],
    queryFn: () => getAutomatedRun({ data: { id: runId } }),
    refetchInterval: (q) => {
      const d = q.state.data as { run?: { status?: string } } | null | undefined;
      return d?.run && d.run.status !== "completed" && d.run.status !== "failed" ? 3000 : false;
    },
  });

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

  const { run, jobs, results, cases, screenshots } = data;
  const resultByJob = new Map(results.map((r) => [r.job_id, r]));
  const caseById = new Map(cases.map((c) => [c.id, c]));

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Automated run</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.target_url} · {new Date(run.created_at).toLocaleString()} · {jobs.length} case(s)
          </p>
        </div>
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

      {run.status !== "completed" && (
        <p className="mb-4 text-sm text-muted-foreground">
          {run.progress_stage ?? run.status} — results appear as the browser worker reports them.
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
