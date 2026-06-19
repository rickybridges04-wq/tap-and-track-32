import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AGENTS } from "@/lib/agents";
import {
  listAgentRuns,
  listAgentTasks,
  pendingApprovalCount,
  useAgentsVersion,
  useMounted,
} from "@/lib/agent-store";
import { AgentStatusBadge } from "@/components/AgentStatusBadge";
import { RunAgentDialog } from "@/components/RunAgentDialog";
import { Bot, ShieldCheck, History, Sparkles } from "lucide-react";

export const Route = createFileRoute("/agents/")({
  head: () => ({ meta: [{ title: "Agents · Bridges Ops" }] }),
  component: AgentsDashboard,
});

function AgentsDashboard() {
  useAgentsVersion();
  const mounted = useMounted();
  const tasks = mounted ? listAgentTasks() : [];
  const runs = mounted ? listAgentRuns() : [];
  const pending = mounted ? pendingApprovalCount() : 0;

  const counts = {
    pending: tasks.filter((t) => t.status === "pending").length,
    running: tasks.filter((t) => t.status === "running").length,
    needs_approval: tasks.filter((t) => t.status === "needs_approval").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI operations center — triggers, routing, approvals, and full task history.
          </p>
        </div>
        <RunAgentDialog />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        <Stat label="Pending" value={counts.pending} />
        <Stat label="Running" value={counts.running} tone="info" />
        <Stat label="Needs approval" value={counts.needs_approval} tone="warn" />
        <Stat label="Completed" value={counts.completed} tone="good" />
        <Stat label="Failed" value={counts.failed} tone="bad" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Agent tasks</CardTitle>
              <CardDescription>{tasks.length} total — newest first.</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/agents/new"><Sparkles className="mr-1 h-4 w-4" /> New task</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No tasks yet. Click "Run Agent" to create one.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {tasks.slice(0, 30).map((t) => {
                  const a = AGENTS[t.agentType];
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                      <Link
                        to="/agents/$taskId"
                        params={{ taskId: t.id }}
                        className="min-w-0 flex-1 hover:underline"
                      >
                        <div className="truncate text-sm font-medium">{t.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          <span className={a.color}>{a.emoji} {a.name}</span> · {t.source} · {new Date(t.createdAt).toLocaleString()}
                        </div>
                      </Link>
                      <AgentStatusBadge status={t.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> Approvals
              </CardTitle>
              <CardDescription>{pending} action(s) waiting</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link to="/agents/approvals">Open queue</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" /> Recent runs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {runs.slice(0, 5).map((r) => (
                    <li key={r.id}>
                      <Link to="/agents/$taskId" params={{ taskId: r.taskId }} className="flex justify-between hover:underline">
                        <span className="truncate">{AGENTS[r.agentType].emoji} {AGENTS[r.agentType].name}</span>
                        <span className="text-xs text-muted-foreground">{r.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4" /> Agent roster
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {Object.values(AGENTS).map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span>{a.emoji}</span>
                    <span className={a.color}>{a.name}</span>
                    <span className="text-xs text-muted-foreground">— {a.short}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" | "warn" | "info" }) {
  const color =
    tone === "good" ? "text-emerald-600" :
    tone === "bad" ? "text-destructive" :
    tone === "warn" ? "text-amber-600" :
    tone === "info" ? "text-sky-600" : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
