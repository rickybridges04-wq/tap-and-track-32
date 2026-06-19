import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getAgentRun,
  getAgentTask,
  listApprovals,
  useAgentsVersion,
  useMounted,
} from "@/lib/agent-store";
import { AGENTS } from "@/lib/agents";
import { decideApproval } from "@/lib/agent-runner";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/agents/approvals")({
  head: () => ({ meta: [{ title: "Approvals · Bridges Ops" }] }),
  component: Approvals,
});

function Approvals() {
  useAgentsVersion();
  const mounted = useMounted();
  if (!mounted) return <AppShell><div className="h-40 animate-pulse rounded-md bg-muted/40" /></AppShell>;

  const approvals = listApprovals();
  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending").slice(0, 20);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Approval queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Agents must wait here before deleting data, sending messages, charging money, or deploying.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Pending ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approvals waiting.</p>
          ) : (
            <ul className="space-y-3">
              {pending.map((a) => {
                const task = getAgentTask(a.taskId);
                const run = getAgentRun(a.runId);
                const agent = run ? AGENTS[run.agentType] : null;
                return (
                  <li key={a.id} className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {agent && <span className={agent.color}>{agent.emoji} {agent.name}</span>}
                          <Badge variant="outline" className="bg-destructive/15 text-destructive">
                            {a.riskLevel} risk
                          </Badge>
                          {task && <Link to="/agents/$taskId" params={{ taskId: task.id }} className="hover:underline">{task.title}</Link>}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm font-medium">
                          <ShieldAlert className="h-4 w-4 text-amber-600" />
                          {a.actionSummary}
                        </div>
                        <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/60 p-2 text-xs">
                          {JSON.stringify(a.payload, null, 2)}
                        </pre>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <Button size="sm" onClick={() => decideApproval(a.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => decideApproval(a.id, "rejected")}>Reject</Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Decisions</CardTitle>
          <CardDescription>Last 20</CardDescription>
        </CardHeader>
        <CardContent>
          {decided.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {decided.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{a.actionSummary}</span>
                  <Badge
                    variant="outline"
                    className={a.status === "approved" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted"}
                  >
                    {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
