import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { TrashButton } from "@/components/TrashButton";
import { Button } from "@/components/ui/button";
import { listRuns, deleteRun, deleteAllRuns, type QaRunRow } from "@/lib/qa/qa.functions";
import { verdictColor, verdictLabel } from "@/lib/qa/scoring";
import { Activity, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/qa/")({
  component: QaDashboard,
});

function QaDashboard() {
  const qc = useQueryClient();
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["qa-runs"],
    queryFn: () => listRuns(),
    refetchInterval: (q) => {
      const rows = (q.state.data as QaRunRow[] | undefined) ?? [];
      return rows.some((r) => r.status !== "completed" && r.status !== "failed") ? 2000 : false;
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteRun({ data: { id } }),
    onSuccess: () => {
      toast.success("Run deleted");
      qc.invalidateQueries({ queryKey: ["qa-runs"] });
    },
  });

  const clearAll = useMutation({
    mutationFn: () => deleteAllRuns(),
    onSuccess: () => {
      toast.success("All runs cleared");
      qc.invalidateQueries({ queryKey: ["qa-runs"] });
    },
  });


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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={runs.length === 0 || clearAll.isPending}
            onClick={() => {
              if (window.confirm("Clear all QA runs? This cannot be undone.")) {
                clearAll.mutate();
              }
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear all
          </Button>
          <Link
            to="/qa/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New crawl
          </Link>
        </div>

      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : runs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {runs.map((r) => (
            <RunCard key={r.id} run={r} onDelete={() => del.mutate(r.id)} />
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

function RunCard({ run, onDelete }: { run: QaRunRow; onDelete: () => void }) {
  const created = new Date(run.created_at).toLocaleString();
  const inFlight = run.status !== "completed" && run.status !== "failed";
  return (
    <div className="relative">
      <Link
        to="/qa/runs/$runId"
        params={{ runId: run.id }}
        className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/40"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{run.target_url}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {created} · {run.depth} · {run.personas.length} personas
            </div>
            {inFlight && (
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${run.progress_pct}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {run.progress_stage ?? run.status}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {run.status === "completed" && run.score !== null && run.verdict ? (
              <>
                <div className="text-2xl font-semibold">{run.score}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${verdictColor(
                    run.verdict as "ready" | "minor" | "major" | "block",
                  )}`}
                >
                  {verdictLabel(run.verdict as "ready" | "minor" | "major" | "block")}
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
      <div className="absolute right-2 top-2">
        <TrashButton
          label="Delete QA run"
          confirm="Delete this QA run? Findings and pages will be removed."
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
