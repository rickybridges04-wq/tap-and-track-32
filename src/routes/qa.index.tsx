import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQaRuns, useMounted, type QaRun } from "@/lib/qa/qa-store";
import { verdictColor, verdictLabel } from "@/lib/qa/scoring";
import { Activity, Plus, Sparkles } from "lucide-react";

export const Route = createFileRoute("/qa/")({
  component: QaDashboard,
});

function QaDashboard() {
  const mounted = useMounted();
  const runs = useQaRuns();

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Synapse QA OS
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Release readiness</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Autonomous AI crawls your app, simulates personas, scores production readiness.
          </p>
        </div>
        <Link
          to="/qa/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New crawl
        </Link>
      </div>

      {mounted && runs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {(mounted ? runs : []).map((r) => (
            <RunCard key={r.id} run={r} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <Activity className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">No QA runs yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Start by pointing the QA agents at a URL.
      </p>
      <Link
        to="/qa/new"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" /> Start a crawl
      </Link>
    </div>
  );
}

function RunCard({ run }: { run: QaRun }) {
  const created = new Date(run.createdAt).toLocaleString();
  return (
    <Link
      to="/qa/runs/$runId"
      params={{ runId: run.id }}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{run.url}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {created} · {run.depth} · {run.personas.length} personas · {run.pages.length} pages ·{" "}
            {run.findings.length} findings
          </div>
          {run.status !== "completed" && run.status !== "failed" && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${run.progress.pct}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{run.progress.stage}</div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {run.status === "completed" && run.score !== undefined && run.verdict ? (
            <>
              <div className="text-2xl font-semibold">{run.score}</div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${verdictColor(run.verdict)}`}
              >
                {verdictLabel(run.verdict)}
              </span>
            </>
          ) : run.status === "failed" ? (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600">
              Failed
            </span>
          ) : (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-600">
              {run.status}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
