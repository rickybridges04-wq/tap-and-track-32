import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentStatusBadge } from "@/components/AgentStatusBadge";
import {
  getAgentTask,
  listApprovals,
  runForTask,
  useAgentsVersion,
  useMounted,
} from "@/lib/agent-store";
import { AGENTS } from "@/lib/agents";
import { decideApproval, useResumeAgentRun, useStartAgentRun } from "@/lib/agent-runner";
import { CheckCircle2, XCircle, Clock, ShieldAlert, Play } from "lucide-react";

export const Route = createFileRoute("/agents/$taskId")({
  head: () => ({ meta: [{ title: "Agent task · Bridges Ops" }] }),
  component: TaskDetail,
});

function TaskDetail() {
  useAgentsVersion();
  const mounted = useMounted();
  const { taskId } = Route.useParams();
  const startRun = useStartAgentRun();
  const resumeRun = useResumeAgentRun();

  if (!mounted) {
    return <AppShell><div className="h-40 animate-pulse rounded-md bg-muted/40" /></AppShell>;
  }

  const task = getAgentTask(taskId);
  if (!task) {
    return (
      <AppShell>
        <Card><CardContent className="py-10 text-center">
          <p className="text-sm">Task not found.</p>
          <Button asChild className="mt-4" variant="outline"><Link to="/agents">Back</Link></Button>
        </CardContent></Card>
      </AppShell>
    );
  }
  const run = runForTask(task.id);
  const agent = AGENTS[task.agentType];
  const approvals = run ? listApprovals().filter((a) => a.runId === run.id) : [];

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={agent.color}>{agent.emoji} {agent.name}</span>
            <span>·</span>
            <span>{task.source}</span>
            <span>·</span>
            <span>{new Date(task.createdAt).toLocaleString()}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{task.title}</h1>
        </div>
        <AgentStatusBadge status={task.status} />
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Input</CardTitle></CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{task.description}</p>
        </CardContent>
      </Card>

      {!run && (
        <div className="mt-4">
          <Button onClick={() => startRun(task)}>
            <Play className="mr-1 h-4 w-4" /> Start run
          </Button>
        </div>
      )}

      {run && (
        <>
          {run.agentSummary && (
            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">Agent diagnosis</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{run.agentSummary}</p></CardContent>
            </Card>
          )}

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Execution timeline</CardTitle>
              <CardDescription>
                {run.steps.length} planned step(s) · status: {run.status}
                {run.retries > 0 && ` · retries: ${run.retries}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {run.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No steps. See report below.</p>
              ) : (
                <ol className="space-y-3">
                  {run.steps.map((s) => {
                    const appr = approvals.find((a) => a.stepId === s.id);
                    return (
                      <li key={s.id} className="rounded-md border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span className="text-xs text-muted-foreground">#{s.idx}</span>
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{s.tool}</code>
                              {s.risky && <Badge variant="outline" className="bg-amber-500/15 text-amber-700">risky</Badge>}
                            </div>
                            {s.reasoning && (
                              <p className="mt-1 text-xs text-muted-foreground">{s.reasoning}</p>
                            )}
                            {s.args !== undefined && (
                              <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
                                {JSON.stringify(s.args, null, 2)}
                              </pre>
                            )}
                            {s.result !== undefined && (
                              <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
                                {JSON.stringify(s.result, null, 2)}
                              </pre>
                            )}
                          </div>
                          <StepStatusIcon status={s.status} />
                        </div>
                        {appr && appr.status === "pending" && (
                          <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-amber-500/10 p-2">
                            <div className="flex items-center gap-2 text-xs">
                              <ShieldAlert className="h-4 w-4 text-amber-600" />
                              <span><strong>Approval needed:</strong> {appr.actionSummary}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={async () => { await decideApproval(appr.id, "approved"); }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => { await decideApproval(appr.id, "rejected"); }}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {run.status === "needs_approval" && approvals.every((a) => a.status !== "pending") && (
                <Button size="sm" className="mt-3" onClick={() => resumeRun(run.id)}>Resume</Button>
              )}
            </CardContent>
          </Card>

          {run.output && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">AI report</CardTitle>
                <CardDescription>
                  {run.completedAt
                    ? `Completed ${new Date(run.completedAt).toLocaleString()}`
                    : "In progress"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{run.output}</pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === "ran" || status === "approved")
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === "failed" || status === "rejected")
    return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "needs_approval")
    return <ShieldAlert className="h-5 w-5 text-amber-600" />;
  return <Clock className="h-5 w-5 text-muted-foreground" />;
}
