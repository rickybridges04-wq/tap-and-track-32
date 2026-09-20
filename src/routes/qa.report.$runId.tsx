import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createShareLink,
  exportReport,
  getReport,
  listShareLinks,
  revokeShareLink,
} from "@/lib/qa/report.functions";
import { DIFF_CLASS, DIFF_LABEL, type DiffState } from "@/lib/qa/regression";

export const Route = createFileRoute("/qa/report/$runId")({
  head: () => ({
    meta: [
      { title: "Automated run report · Synapse QA OS" },
      {
        name: "description",
        content:
          "Pass rate, critical failures, regression diff, failure groups, performance and accessibility summaries for one automated test run, exportable as CSV or PDF.",
      },
      { property: "og:title", content: "Automated run report · Synapse QA OS" },
      {
        property: "og:description",
        content: "Shareable evidence-backed report for an automated test run.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-destructive">Could not load this report: {error.message}</p>
    </AppShell>
  ),
});

function download(filename: string, mime: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportPage() {
  const { runId } = Route.useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery({
    queryKey: ["qa-report", runId],
    queryFn: () => getReport({ data: { run_id: runId } }),
  });
  const { data: shares } = useQuery({
    queryKey: ["qa-report-shares", runId],
    queryFn: () => listShareLinks({ data: { run_id: runId } }),
  });

  const share = useMutation({
    mutationFn: () => createShareLink({ data: { run_id: runId, days: 7 } }),
    onSuccess: (s) => {
      const url = `${window.location.origin}${s.path}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Share link created and copied. It expires in 7 days.");
      qc.invalidateQueries({ queryKey: ["qa-report-shares", runId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeShareLink({ data: { id } }),
    onSuccess: () => {
      toast.success("Share link revoked.");
      qc.invalidateQueries({ queryKey: ["qa-report-shares", runId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function doExport(format: "csv" | "pdf") {
    setBusy(format);
    try {
      const file = await exportReport({ data: { run_id: runId, format } });
      download(file.filename, file.mime, file.base64);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading report…</p>
      </AppShell>
    );
  }
  if (!report) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Report not found.</p>
      </AppShell>
    );
  }

  const r = report;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            RUN #{r.run.short_id} · report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.project?.name ?? "Unattached"} · {r.run.target_url} ·{" "}
            {new Date(r.run.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => doExport("csv")} disabled={busy === "csv"}>
            {busy === "csv" ? "Exporting…" : "Export CSV"}
          </Button>
          <Button variant="outline" onClick={() => doExport("pdf")} disabled={busy === "pdf"}>
            {busy === "pdf" ? "Exporting…" : "Export PDF"}
          </Button>
          <Button onClick={() => share.mutate()} disabled={share.isPending}>
            {share.isPending ? "Creating…" : "Share link"}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Pass rate" value={`${r.run.pass_rate_pct}%`} />
        <Stat label="Cases" value={`${r.run.passed} pass · ${r.run.failed} fail`} />
        <Stat label="Readiness score" value={r.run.score != null ? String(r.run.score) : "—"} />
        <Stat label="Verdict" value={r.run.verdict ?? "—"} />
      </div>

      {(r.summary || r.summary_warning) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Executive summary</CardTitle>
            <CardDescription>
              Restates the run numbers only. Rejected server-side if it introduces any figure the
              data does not contain.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {r.summary ?? (
              <span className="text-muted-foreground">{r.summary_warning}</span>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Regression diff</CardTitle>
          <CardDescription>
            {r.previous_run_id
              ? `Compared with run #${r.previous_run_id.slice(0, 8)}.`
              : "No earlier completed automated run for this project."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {r.diff.length === 0 && <p className="text-muted-foreground">No cases recorded.</p>}
          {r.diff.map((d) => (
            <div key={d.case_id} className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DIFF_CLASS[d.state as DiffState]}`}>
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Critical failures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {r.critical_failures.length === 0 && (
            <p className="text-muted-foreground">None.</p>
          )}
          {r.critical_failures.map((f, i) => (
            <div key={i} className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <span className="font-mono text-xs">{f.code}</span> step {f.step ?? "—"} — {f.error}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">
            Failure groups · {r.failure_groups.length} root cause
            {r.failure_groups.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {r.failure_groups.length === 0 && <p className="text-muted-foreground">None.</p>}
          {r.failure_groups.map((g) => (
            <div key={g.signature} className="rounded-md border border-border p-3">
              <div className="font-medium">
                {g.failures} failure{g.failures === 1 ? "" : "s"} · {g.cases.join(", ")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{g.error_message ?? "no message"}</p>
              {g.likely_cause && (
                <p className="mt-2">
                  <span className="mr-2 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-600">
                    Suggestion — AI
                  </span>
                  {g.likely_cause}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Median LCP {r.performance.median_lcp_ms ?? "—"} ms</p>
            <p>Median TTFB {r.performance.median_ttfb_ms ?? "—"} ms</p>
            <p>Median FCP {r.performance.median_fcp_ms ?? "—"} ms</p>
            {r.performance.slowest.slice(0, 5).map((s) => (
              <p key={s.code} className="text-xs text-muted-foreground">
                {s.code} — {s.duration_ms} ms
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accessibility</CardTitle>
            <CardDescription>{r.accessibility.total_violations} violation(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="text-xs text-muted-foreground">
              critical {r.accessibility.by_impact.critical} · serious{" "}
              {r.accessibility.by_impact.serious} · moderate {r.accessibility.by_impact.moderate} ·
              minor {r.accessibility.by_impact.minor}
            </p>
            {r.accessibility.top.slice(0, 6).map((a) => (
              <p key={a.id} className="text-xs">
                <span className="font-mono">{a.id}</span> ({a.impact}) ×{a.nodes} — {a.help}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      {(shares ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Share links</CardTitle>
            <CardDescription>Read-only, expiring, no sign-in required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(shares ?? []).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all font-mono text-xs">/api/public/report/{s.token}</span>
                <span className="text-xs text-muted-foreground">
                  expires {new Date(s.expires_at).toLocaleDateString()}
                </span>
                <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
