import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrashButton } from "@/components/TrashButton";
import {
  deleteRun as deleteTesterRun,
  getProject,
  listRuns as listTesterRuns,
  useStoreVersion,
} from "@/lib/store";
import {
  deleteAgentRun,
  listAgentRuns,
  listAgentTasks,
  useAgentsVersion,
  useMounted,
} from "@/lib/agent-store";
import { listRuns as listQaRuns, deleteRun as deleteQaRunFn, type QaRunRow } from "@/lib/qa/qa.functions";
import { AGENTS } from "@/lib/agents";
import { verdictColor, verdictLabel } from "@/lib/qa/scoring";
import { Activity, FlaskConical, Bot, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Beta test history · Walkthrough Wizard QAOS" }] }),
  component: HistoryPage,
});

type Row = {
  id: string;
  kind: "tester" | "qa" | "agent";
  title: string;
  subtitle: string;
  badge: string;
  badgeClass?: string;
  createdAt: string;
  href: { to: string; params: Record<string, string> };
  onDelete: () => void;
};

function HistoryPage() {
  useStoreVersion();
  useAgentsVersion();
  const mounted = useMounted();
  const qc = useQueryClient();
  const { data: qaRuns = [] } = useQuery({
    queryKey: ["qa-runs"],
    queryFn: () => listQaRuns(),
  });
  const delQa = useMutation({
    mutationFn: (id: string) => deleteQaRunFn({ data: { id } }),
    onSuccess: () => {
      toast.success("QA run deleted");
      qc.invalidateQueries({ queryKey: ["qa-runs"] });
    },
  });

  if (!mounted) {
    return <AppShell><div className="h-40 animate-pulse rounded-md bg-muted/40" /></AppShell>;
  }

  const testerRuns = listTesterRuns();
  const agentRuns = listAgentRuns();
  const agentTasks = listAgentTasks();

  const rows: Row[] = [
    ...testerRuns.map<Row>((r) => {
      const p = getProject(r.projectId);
      return {
        id: `tester-${r.id}`,
        kind: "tester",
        title: p?.name ?? "Unknown project",
        subtitle: `${r.stats.pass} pass · ${r.stats.warn} warn · ${r.stats.fail} fail`,
        badge: r.status,
        createdAt: r.startedAt,
        href: { to: "/runs/$id", params: { id: r.id } },
        onDelete: () => {
          deleteTesterRun(r.id);
          toast.success("Tester run deleted");
        },
      };
    }),
    ...qaRuns.map<Row>((r: QaRunRow) => ({
      id: `qa-${r.id}`,
      kind: "qa",
      title: r.target_url,
      subtitle: `${r.depth} · ${r.personas.length} personas`,
      badge: r.verdict ? verdictLabel(r.verdict as "ready" | "minor" | "major" | "block") : r.status,
      badgeClass: r.verdict ? verdictColor(r.verdict as "ready" | "minor" | "major" | "block") : undefined,
      createdAt: r.created_at,
      href: { to: "/qa/runs/$runId", params: { runId: r.id } },
      onDelete: () => delQa.mutate(r.id),
    })),
    ...agentRuns.map<Row>((r) => {
      const t = agentTasks.find((x) => x.id === r.taskId);
      const a = AGENTS[r.agentType];
      return {
        id: `agent-${r.id}`,
        kind: "agent",
        title: t?.title ?? r.input.title,
        subtitle: `${a.emoji} ${a.name} · ${r.steps.length} step(s)`,
        badge: r.status,
        createdAt: r.createdAt,
        href: { to: "/agents/$taskId", params: { taskId: r.taskId } },
        onDelete: () => {
          deleteAgentRun(r.id);
          toast.success("Agent run deleted");
        },
      };
    }),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <AppShell>
      <div>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5" /> Beta test history
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Everything we've tested</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tester walkthroughs, QA crawls, and agent runs — all in one timeline.
        </p>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">All runs ({rows.length})</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    to={r.href.to as never}
                    params={r.href.params as never}
                    className="flex min-w-0 flex-1 items-start gap-2 hover:underline"
                  >
                    <KindIcon kind={r.kind} />
                    <span className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.subtitle} · {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline" className={r.badgeClass}>{r.badge}</Badge>
                    <TrashButton
                      label="Delete from history"
                      confirm="Remove this run from history?"
                      onDelete={r.onDelete}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function KindIcon({ kind }: { kind: Row["kind"] }) {
  const cls = "mt-0.5 h-4 w-4 shrink-0";
  if (kind === "tester") return <Activity className={`${cls} text-sky-500`} aria-label="Tester run" />;
  if (kind === "qa") return <Sparkles className={`${cls} text-fuchsia-500`} aria-label="QA run" />;
  return <Bot className={`${cls} text-emerald-500`} aria-label="Agent run" />;
}
