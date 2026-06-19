import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProjects, listRuns, useStoreVersion } from "@/lib/store";
import { useMounted } from "@/lib/agent-store";
import { Plus, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Bridges Tester" },
      { name: "description", content: "AI-powered usability testing for your web apps." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  useStoreVersion();
  const mounted = useMounted();
  const projects = mounted ? listProjects() : [];
  const runs = mounted ? listRuns() : [];

  const stats = useMemo(() => {
    const last = runs.slice(0, 50);
    const pass = last.reduce((a, r) => a + r.stats.pass, 0);
    const fail = last.reduce((a, r) => a + r.stats.fail, 0);
    const warn = last.reduce((a, r) => a + r.stats.warn, 0);
    return { pass, fail, warn, runs: runs.length };
  }, [runs]);

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All your apps, their latest runs, and outstanding issues.
          </p>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="mr-1 h-4 w-4" /> New project
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Total runs" value={stats.runs} />
        <StatCard label="Passing steps" value={stats.pass} tone="good" />
        <StatCard label="Failing steps" value={stats.fail} tone="bad" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Apps registered for testing.</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                body="Add the public URL of your app to run your first usability walkthrough."
                action={
                  <Button asChild>
                    <Link to="/projects/new">
                      <Plus className="mr-1 h-4 w-4" /> Add project
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {projects.map((p) => {
                  const last = runs.find((r) => r.projectId === p.id);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <Link
                          to="/projects/$id"
                          params={{ id: p.id }}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">{p.baseUrl}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {last ? <RunBadge stats={last.stats} /> : <Badge variant="outline">No runs</Badge>}
                        <Button asChild size="sm" variant="outline">
                          <Link to="/projects/$id" params={{ id: p.id }}>Open</Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Latest 10 walkthroughs.</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              <ul className="space-y-2">
                {runs.slice(0, 10).map((r) => {
                  const proj = projects.find((p) => p.id === r.projectId);
                  return (
                    <li key={r.id}>
                      <Link
                        to="/runs/$id"
                        params={{ id: r.id }}
                        className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{proj?.name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.startedAt).toLocaleString()}
                          </div>
                        </div>
                        <RunBadge stats={r.stats} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Heads up — base build</CardTitle>
          <CardDescription>
            Runs are simulated until Lovable Cloud + Browserbase are connected.
            See <Link to="/settings" className="underline">Settings</Link> for the exact secrets and links you'll need.
            <ExternalLink className="ml-1 inline h-3 w-3" />
          </CardDescription>
        </CardHeader>
      </Card>
    </AppShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div
          className={
            "mt-1 text-2xl font-semibold " +
            (tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-destructive" : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function RunBadge({ stats }: { stats: { pass: number; fail: number; warn: number } }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {stats.pass}
      </span>
      <span className="inline-flex items-center gap-1 text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        {stats.warn}
      </span>
      <span className="inline-flex items-center gap-1 text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        {stats.fail}
      </span>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
