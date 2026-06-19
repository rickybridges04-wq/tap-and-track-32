import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENTS } from "@/lib/agents";
import {
  listAgentRuns,
  listAgentTasks,
  useAgentsVersion,
  useMounted,
} from "@/lib/agent-store";
import { AgentStatusBadge } from "@/components/AgentStatusBadge";

export const Route = createFileRoute("/agents/history")({
  head: () => ({ meta: [{ title: "Agent history · Bridges Ops" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  useAgentsVersion();
  const mounted = useMounted();
  if (!mounted) return <AppShell><div className="h-40 animate-pulse rounded-md bg-muted/40" /></AppShell>;

  const runs = listAgentRuns();
  const tasks = listAgentTasks();

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every agent run, newest first.</p>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Runs ({runs.length})</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {runs.map((r) => {
                const task = tasks.find((t) => t.id === r.taskId);
                const a = AGENTS[r.agentType];
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <Link
                      to="/agents/$taskId"
                      params={{ taskId: r.taskId }}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <div className="truncate text-sm font-medium">
                        {task?.title ?? r.input.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        <span className={a.color}>{a.emoji} {a.name}</span> · {r.steps.length} step(s) · {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </Link>
                    <AgentStatusBadge status={r.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
