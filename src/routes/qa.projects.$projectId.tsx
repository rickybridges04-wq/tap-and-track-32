import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TrashButton } from "@/components/TrashButton";
import { StepsEditor } from "@/components/StepsEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteCase,
  deleteSuite,
  getProject,
  saveCase,
  saveProject,
  saveSuite,
  startAutomatedRun,
  type TestCase,
} from "@/lib/qa/projects.functions";
import { StepsSchema, type Step } from "@/lib/qa/steps";
import { Play, Plus } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["auth", "crud", "security", "ui", "api", "a11y", "performance", "other"] as const;

export const Route = createFileRoute("/qa/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project · Synapse QA OS" },
      {
        name: "description",
        content: "Suites, automated test cases and run history for one tested app.",
      },
      { property: "og:title", content: "Project · Synapse QA OS" },
      {
        property: "og:description",
        content: "Edit test suites and cases, then run them in a real browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectDetail,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-destructive">Could not load this project: {error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Project not found.</p>
    </AppShell>
  ),
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [newSuite, setNewSuite] = useState("");
  const [newSuiteCat, setNewSuiteCat] = useState<(typeof CATEGORIES)[number]>("auth");
  const [caseDraft, setCaseDraft] = useState<null | {
    id?: string;
    suite_id: string;
    code: string;
    title: string;
    expected: string;
    steps: Step[];
  }>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["qa-project", projectId],
    queryFn: () => getProject({ data: { id: projectId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["qa-project", projectId] });

  const addSuite = useMutation({
    mutationFn: () =>
      saveSuite({ data: { project_id: projectId, name: newSuite, category: newSuiteCat } }),
    onSuccess: () => {
      setNewSuite("");
      toast.success("Suite added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSuite = useMutation({
    mutationFn: (id: string) => deleteSuite({ data: { id } }),
    onSuccess: () => {
      toast.success("Suite deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCase = useMutation({
    mutationFn: (id: string) => deleteCase({ data: { id } }),
    onSuccess: () => {
      toast.success("Case deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const persistCase = useMutation({
    mutationFn: () => {
      if (!caseDraft) throw new Error("Nothing to save");
      const steps = StepsSchema.parse(caseDraft.steps);
      return saveCase({
        data: {
          id: caseDraft.id,
          project_id: projectId,
          suite_id: caseDraft.suite_id,
          code: caseDraft.code,
          title: caseDraft.title,
          expected: caseDraft.expected,
          steps_json: steps,
          generated_by: "human",
        },
      });
    },
    onSuccess: () => {
      setCaseDraft(null);
      toast.success("Test case saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runAutomated = useMutation({
    mutationFn: () => startAutomatedRun({ data: { project_id: projectId } }),
    onSuccess: (res) => {
      toast.success(`Queued ${res.jobs} test case${res.jobs === 1 ? "" : "s"}`);
      navigate({ to: "/qa/automated/$runId", params: { runId: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMeta = useMutation({
    mutationFn: (input: {
      name: string;
      base_url: string;
      environment: "staging" | "production";
      username: string;
      password: string;
    }) =>
      saveProject({
        data: {
          id: projectId,
          name: input.name,
          base_url: input.base_url,
          environment: input.environment,
          username: input.username || null,
          password: input.password || null,
        },
      }),
    onSuccess: () => {
      setEditing(false);
      toast.success("Project updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </AppShell>
    );
  }

  const { project, suites, cases, runs } = data;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.base_url} · {project.environment}
            {project.username ? ` · test user ${project.username}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            Edit project
          </Button>
          <Button
            size="sm"
            disabled={cases.length === 0 || runAutomated.isPending}
            onClick={() => runAutomated.mutate()}
          >
            <Play className="mr-1 h-3.5 w-3.5" /> Run automated
          </Button>
        </div>
      </div>

      {editing && (
        <EditProject
          project={project}
          pending={saveMeta.isPending}
          onSave={(v) => saveMeta.mutate(v)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suites &amp; cases</CardTitle>
            <CardDescription>{cases.length} test case(s) across {suites.length} suite(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="suite-name">New suite</Label>
                <Input
                  id="suite-name"
                  value={newSuite}
                  onChange={(e) => setNewSuite(e.target.value)}
                  placeholder="Sign-in flow"
                />
              </div>
              <select
                aria-label="Suite category"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={newSuiteCat}
                onChange={(e) => setNewSuiteCat(e.target.value as (typeof CATEGORIES)[number])}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button size="sm" disabled={!newSuite || addSuite.isPending} onClick={() => addSuite.mutate()}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>

            {suites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suites yet.</p>
            ) : (
              suites.map((s) => (
                <div key={s.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.category}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setCaseDraft({
                            suite_id: s.id,
                            code: "",
                            title: "",
                            expected: "",
                            steps: [{ action: "goto", value: "/" }],
                          })
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Case
                      </Button>
                      <TrashButton
                        label={`Delete suite ${s.name}`}
                        confirm={`Delete suite "${s.name}" and its cases?`}
                        onDelete={() => removeSuite.mutate(s.id)}
                      />
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {cases
                      .filter((c) => c.suite_id === s.id)
                      .map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1 text-xs"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left hover:underline"
                            onClick={() => setCaseDraft(toDraft(c))}
                          >
                            <span className="font-mono">{c.code}</span> — {c.title}
                          </button>
                          <TrashButton
                            label={`Delete case ${c.code}`}
                            confirm={`Delete case ${c.code}?`}
                            onDelete={() => removeCase.mutate(c.id)}
                          />
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run history</CardTitle>
            <CardDescription>Crawl runs and automated runs together</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              runs.map((r) => (
                <Link
                  key={r.id}
                  to={r.kind === "automated" ? "/qa/automated/$runId" : "/qa/runs/$runId"}
                  params={r.kind === "automated" ? { runId: r.id } : { runId: r.id }}
                  className="block rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{r.kind}</span>
                    <span className="flex-1 truncate text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    <span className="text-xs">
                      {r.status === "completed"
                        ? `${r.score ?? "–"} · ${r.passed_count ?? 0} pass / ${r.failed_count ?? 0} fail`
                        : r.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {caseDraft && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">{caseDraft.id ? "Edit" : "New"} test case</CardTitle>
            <CardDescription>
              Paths are relative to the project base URL. Use {"{{username}}"} / {"{{password}}"} for
              the saved test login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="c-code">Code</Label>
                <Input
                  id="c-code"
                  placeholder="AUTH-001"
                  value={caseDraft.code}
                  onChange={(e) => setCaseDraft({ ...caseDraft, code: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="c-title">Title</Label>
                <Input
                  id="c-title"
                  value={caseDraft.title}
                  onChange={(e) => setCaseDraft({ ...caseDraft, title: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="c-expected">Expected result</Label>
              <Textarea
                id="c-expected"
                rows={2}
                value={caseDraft.expected}
                onChange={(e) => setCaseDraft({ ...caseDraft, expected: e.target.value })}
              />
            </div>
            <StepsEditor
              steps={caseDraft.steps}
              onChange={(steps) => setCaseDraft({ ...caseDraft, steps })}
            />
            <div className="flex gap-2">
              <Button
                disabled={!caseDraft.code || !caseDraft.title || persistCase.isPending}
                onClick={() => persistCase.mutate()}
              >
                {persistCase.isPending ? "Saving…" : "Save case"}
              </Button>
              <Button variant="ghost" onClick={() => setCaseDraft(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}

function toDraft(c: TestCase) {
  const parsed = StepsSchema.safeParse(c.steps_json);
  return {
    id: c.id,
    suite_id: c.suite_id,
    code: c.code,
    title: c.title,
    expected: c.expected,
    steps: parsed.success ? parsed.data : [],
  };
}

function EditProject({
  project,
  pending,
  onSave,
}: {
  project: { name: string; base_url: string; environment: "staging" | "production"; username: string | null };
  pending: boolean;
  onSave: (v: {
    name: string;
    base_url: string;
    environment: "staging" | "production";
    username: string;
    password: string;
  }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [baseUrl, setBaseUrl] = useState(project.base_url);
  const [environment, setEnvironment] = useState(project.environment);
  const [username, setUsername] = useState(project.username ?? "");
  const [password, setPassword] = useState("");

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Edit project</CardTitle>
        <CardDescription>Leave the password blank to keep the saved one.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="e-name">Name</Label>
          <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="e-url">Base URL</Label>
          <Input id="e-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="e-env">Environment</Label>
          <select
            id="e-env"
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
            <Label htmlFor="e-user">Test username</Label>
            <Input id="e-user" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="e-pass">Test password</Label>
            <Input
              id="e-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <Button
            disabled={pending}
            onClick={() => onSave({ name, base_url: baseUrl, environment, username, password })}
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
