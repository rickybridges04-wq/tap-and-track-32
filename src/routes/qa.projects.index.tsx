import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TrashButton } from "@/components/TrashButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteProject,
  listProjects,
  loadSelfTestSuite,
  saveProject,
} from "@/lib/qa/projects.functions";
import { FlaskConical, Plus, Beaker } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/qa/projects/")({
  head: () => ({
    meta: [
      { title: "Test projects · Synapse QA OS" },
      {
        name: "description",
        content:
          "Register the apps you test, store their base URL and environment, and run automated browser test suites against them.",
      },
      { property: "og:title", content: "Test projects · Synapse QA OS" },
      {
        property: "og:description",
        content: "Automated browser test suites, cases and run history for every app you ship.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["qa-projects"],
    queryFn: () => listProjects(),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteProject({ data: { id } }),
    onSuccess: () => {
      toast.success("Project deleted");
      qc.invalidateQueries({ queryKey: ["qa-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selfTest = useMutation({
    mutationFn: () => loadSelfTestSuite({ data: {} }),
    onSuccess: () => {
      toast.success("Self-test project ready");
      qc.invalidateQueries({ queryKey: ["qa-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <FlaskConical className="h-3.5 w-3.5" /> Synapse QA OS
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Test projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each project holds its own suites, test cases and run history.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => selfTest.mutate()}
            disabled={selfTest.isPending}
            title="Owner only: create a project that tests this app itself"
          >
            <Beaker className="mr-1 h-4 w-4" />
            {selfTest.isPending ? "Loading…" : "Load self-test suite"}
          </Button>
          <Button onClick={() => setOpen((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" /> New project
          </Button>
        </div>
      </div>

      {open && (
        <ProjectForm
          onDone={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["qa-projects"] });
          }}
        />
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No test projects yet. Add one to start building automated test cases.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{p.name}</CardTitle>
                  <CardDescription className="truncate">{p.base_url}</CardDescription>
                </div>
                <TrashButton
                  label={`Delete project ${p.name}`}
                  confirm={`Delete "${p.name}" with its suites, cases and runs?`}
                  onDelete={() => del.mutate(p.id)}
                />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">{p.environment}</span>
                  {p.has_password && <span>test login saved</span>}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/qa/projects/$projectId" params={{ projectId: p.id }}>
                    Open
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ProjectForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://");
  const [environment, setEnvironment] = useState<"staging" | "production">("staging");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saveProject({
        data: {
          name,
          base_url: baseUrl,
          environment,
          username: username || null,
          password: password || null,
        },
      }),
    onSuccess: () => {
      toast.success("Project created");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">New test project</CardTitle>
        <CardDescription>
          Test credentials are only used to fill {"{{username}}"} / {"{{password}}"} placeholders in
          steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="p-name">Name</Label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="p-url">Base URL</Label>
          <Input id="p-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="p-env">Environment</Label>
          <select
            id="p-env"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as "staging" | "production")}
          >
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="p-user">Test username</Label>
            <Input id="p-user" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-pass">Test password</Label>
            <Input
              id="p-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <Button disabled={!name || !baseUrl.startsWith("http") || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Create project"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
