import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  deleteProject,
  getProject,
  runsForProject,
  simulateRun,
  upsertProject,
  useStoreVersion,
} from "@/lib/store";
import { useMounted } from "@/lib/agent-store";
import { toast } from "sonner";
import { Play, Trash2, Calendar, Webhook } from "lucide-react";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({ meta: [{ title: "Project · Bridges Tester" }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  useStoreVersion();
  const mounted = useMounted();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const project = mounted ? getProject(id) : undefined;
  const runs = runsForProject(id);
  const [running, setRunning] = useState(false);
  const [cron, setCron] = useState(project?.schedule?.cron ?? "0 9 * * *");
  const [schedEnabled, setSchedEnabled] = useState(project?.schedule?.enabled ?? false);

  if (!project) {
    return (
      <AppShell>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm">Project not found.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  async function triggerRun() {
    setRunning(true);
    toast.info("Run queued — simulating walkthrough…");
    await new Promise((r) => setTimeout(r, 1200));
    const r = simulateRun(project!.id, "manual");
    setRunning(false);
    toast.success("Run complete");
    navigate({ to: "/runs/$id", params: { id: r.id } });
  }

  function saveSchedule() {
    upsertProject({
      ...project!,
      schedule: { cron: cron.trim(), enabled: schedEnabled },
    });
    toast.success("Schedule saved");
  }

  function remove() {
    if (!confirm("Delete this project and all its runs?")) return;
    deleteProject(project!.id);
    navigate({ to: "/" });
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-semibold tracking-tight">{project.name}</h1>
          <a href={project.baseUrl} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:underline">
            {project.baseUrl}
          </a>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={triggerRun} disabled={running}>
            <Play className="mr-1 h-4 w-4" /> {running ? "Running…" : "Run now"}
          </Button>
          <Button variant="outline" onClick={remove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {project.notes && (
        <p className="mt-3 text-sm text-muted-foreground">{project.notes}</p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Run history</CardTitle>
            <CardDescription>{runs.length} run(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet. Click "Run now" to start one.</p>
            ) : (
              <ul className="divide-y divide-border">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <Link to="/runs/$id" params={{ id: r.id }} className="text-sm hover:underline">
                      {new Date(r.startedAt).toLocaleString()}
                    </Link>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{r.trigger}</Badge>
                      <span className="text-emerald-600">{r.stats.pass} pass</span>
                      <span className="text-amber-600">{r.stats.warn} warn</span>
                      <span className="text-destructive">{r.stats.fail} fail</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" /> Schedule
              </CardTitle>
              <CardDescription>Cron expression — e.g. <code>0 9 * * *</code> for daily 9am UTC.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="cron">Cron</Label>
                <Input id="cron" value={cron} onChange={(e) => setCron(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled" className="text-sm">Enabled</Label>
                <Switch id="enabled" checked={schedEnabled} onCheckedChange={setSchedEnabled} />
              </div>
              <Button onClick={saveSchedule} className="w-full">Save schedule</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Webhook className="h-4 w-4" /> CI trigger
              </CardTitle>
              <CardDescription>POST to trigger a run from CI.</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="block break-all rounded-md bg-muted p-2 text-xs">
                POST /api/public/runs/trigger
                {"\n"}x-bridges-signature: HMAC-SHA256
                {"\n"}{`{"projectId":"${project.id}"}`}
              </code>
              <p className="mt-2 text-xs text-muted-foreground">
                Configure the signing secret in <Link to="/settings" className="underline">Settings</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
