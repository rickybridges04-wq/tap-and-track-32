import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getRun, getProject, saveRun, useStoreVersion } from "@/lib/store";
import type { Run, RunStep, Finding } from "@/lib/store";
import { useMounted } from "@/lib/agent-store";
import { CheckCircle2, XCircle, AlertTriangle, Download, Wrench, Sparkles } from "lucide-react";
import { RunAgentDialog } from "@/components/RunAgentDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/runs/$id")({
  head: () => ({ meta: [{ title: "Run · Bridges Tester" }] }),
  component: RunDetail,
});

function RunDetail() {
  useStoreVersion();
  const mounted = useMounted();
  const { id } = Route.useParams();
  const run = mounted ? getRun(id) : undefined;
  const project = run ? getProject(run.projectId) : undefined;

  if (!mounted) {
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-md bg-muted/40" />
      </AppShell>
    );
  }

  if (!run) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm">Run not found.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  function exportMarkdown() {
    const md = run!.report ?? "";
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${run!.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Run</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project ? (
              <Link to="/projects/$id" params={{ id: project.id }} className="hover:underline">
                {project.name}
              </Link>
            ) : (
              "Unknown project"
            )}{" "}
            · {new Date(run.startedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportMarkdown}>
            <Download className="mr-1 h-4 w-4" /> Markdown
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Status" value={run.status} />
        <Stat label="Interactions passed" value={run.stats.pass} tone="good" />
        <Stat label="Warnings" value={run.stats.warn} tone="warn" />
        <Stat label="Failed interactions" value={run.stats.fail} tone="bad" />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Each interaction below is a detected click, input, or navigation captured during the run.
        Open a tab to inspect the flow, errors, or AI analysis.
      </p>

      <Tabs defaultValue="timeline" className="mt-4">
        <TabsList aria-label="Run report sections">
          <TabsTrigger value="timeline">Step-by-step ({run.steps.length})</TabsTrigger>
          <TabsTrigger value="checklist">Interactions checklist</TabsTrigger>
          <TabsTrigger value="errors">
            Errors ({run.steps.reduce((n, s) => n + s.consoleErrors.length + s.networkErrors.length, 0)})
          </TabsTrigger>
          <TabsTrigger value="findings">Findings ({run.findings.length})</TabsTrigger>
          <TabsTrigger value="fixes">Fix suggestions ({run.findings.length + extractReportSuggestions(run.report).length})</TabsTrigger>
          <TabsTrigger value="report">AI report</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <div className="space-y-4">
            {run.steps.map((s) => (
              <StepCard key={s.id} run={run} step={s} />
            ))}
            {run.steps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No interactions were detected in this run.
              </p>
            )}
          </div>
        </TabsContent>


        <TabsContent value="checklist" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ul className="divide-y divide-border">
                {run.steps.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.element}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.action} · {s.pageUrl}</div>
                    </div>
                    <StatusIcon status={s.status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Console errors</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorList items={run.steps.flatMap((s) => s.consoleErrors)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Network errors</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorList items={run.steps.flatMap((s) => s.networkErrors)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="findings" className="mt-4 space-y-3">
          {run.findings.map((f) => (
            <FindingCard key={f.id} run={run} finding={f} />
          ))}
          {run.findings.length === 0 && (
            <p className="text-sm text-muted-foreground">No findings.</p>
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{run.report}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StepCard({ run, step }: { run: Run; step: RunStep }) {
  const [note, setNote] = useState(step.note ?? "");
  function saveNote() {
    const updated = {
      ...run,
      steps: run.steps.map((s) => (s.id === step.id ? { ...s, note } : s)),
    };
    saveRun(updated);
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-sm">
            <span className="text-muted-foreground">Step #{step.idx}</span> · {step.element}
          </CardTitle>
          <CardDescription className="truncate">
            <span className="font-medium capitalize text-foreground">{step.action}</span>
            <span aria-hidden> · </span>
            <span title={step.pageUrl}>{step.pageUrl}</span>
          </CardDescription>
        </div>
        <StatusIcon status={step.status} />
      </CardHeader>
      <CardContent>
        {step.screenshot && (
          <img
            src={step.screenshot}
            alt={`Screenshot for step ${step.idx}: ${step.action} on ${step.element}`}
            className="rounded-md border border-border"
            loading="lazy"
          />
        )}
        {(step.consoleErrors.length > 0 || step.networkErrors.length > 0) && (
          <div className="mt-3 space-y-1 text-xs">
            {step.consoleErrors.map((e, i) => (
              <div key={`c${i}`} className="rounded bg-destructive/10 px-2 py-1 font-mono text-destructive">
                console: {e}
              </div>
            ))}
            {step.networkErrors.map((e, i) => (
              <div key={`n${i}`} className="rounded bg-destructive/10 px-2 py-1 font-mono text-destructive">
                network: {e}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <label htmlFor={`note-${step.id}`} className="sr-only">
            Note for step {step.idx}
          </label>
          <Textarea
            id={`note-${step.id}`}
            aria-label={`Note for step ${step.idx}`}
            placeholder="Add a note or mark known issue…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            className="min-h-[60px] text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}


function FindingCard({ run, finding }: { run: Run; finding: Finding }) {
  function setStatus(status: Finding["status"]) {
    saveRun({
      ...run,
      findings: run.findings.map((f) => (f.id === finding.id ? { ...f, status } : f)),
    });
  }
  const sev = {
    high: "bg-destructive/15 text-destructive",
    medium: "bg-amber-500/15 text-amber-700",
    low: "bg-muted text-foreground",
  }[finding.severity];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${sev}`}>{finding.severity}</span>
            <CardTitle className="text-sm">{finding.title}</CardTitle>
          </div>
          <CardDescription className="mt-1">{finding.body}</CardDescription>
        </div>
        <Badge variant="outline">{finding.status}</Badge>
      </CardHeader>
      <CardContent className="flex gap-2 pt-0">
        <Button size="sm" variant="outline" onClick={() => setStatus("resolved")}>Mark resolved</Button>
        <Button size="sm" variant="ghost" onClick={() => setStatus("ignored")}>Ignore</Button>
        <Button size="sm" variant="ghost" onClick={() => setStatus("open")}>Reopen</Button>
      </CardContent>
    </Card>
  );
}

function ErrorList({ items }: { items: string[] }) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">None captured.</p>;
  const counts = new Map<string, number>();
  for (const e of items) counts.set(e, (counts.get(e) ?? 0) + 1);
  return (
    <ul className="space-y-1 text-xs">
      {[...counts.entries()].map(([e, n]) => (
        <li key={e} className="rounded bg-muted px-2 py-1 font-mono">
          <span className="mr-2 inline-block min-w-[2ch] rounded bg-background px-1 text-center">{n}</span>
          {e}
        </li>
      ))}
    </ul>
  );
}

function StatusIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  const label = status === "pass" ? "Passed" : status === "warn" ? "Warning" : "Failed";
  const Icon = status === "pass" ? CheckCircle2 : status === "warn" ? AlertTriangle : XCircle;
  const color = status === "pass" ? "text-emerald-500" : status === "warn" ? "text-amber-500" : "text-destructive";
  return <Icon role="img" aria-label={`Status: ${label}`} className={`h-5 w-5 ${color}`} />;
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-destructive" : "";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
