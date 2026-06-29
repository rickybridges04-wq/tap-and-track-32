import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrashButton } from "@/components/TrashButton";
import { deleteProject, listProjects, useStoreVersion } from "@/lib/store";
import { useMounted } from "@/lib/agent-store";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/projects/")({
  head: () => ({ meta: [{ title: "Projects · Bridges Tester" }] }),
  component: ProjectsList,
});

function ProjectsList() {
  useStoreVersion();
  const mounted = useMounted();
  const projects = mounted ? listProjects() : [];
  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Apps registered for AI usability testing.</p>
        </div>
        <Button asChild>
          <Link to="/projects/new"><Plus className="mr-1 h-4 w-4" /> New project</Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{p.name}</CardTitle>
                <CardDescription className="truncate">{p.baseUrl}</CardDescription>
              </div>
              <TrashButton
                label={`Delete project ${p.name}`}
                confirm={`Delete "${p.name}" and all its runs?`}
                onDelete={() => {
                  deleteProject(p.id);
                  toast.success("Project deleted");
                }}
              />
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline">
                <Link to="/projects/$id" params={{ id: p.id }}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {projects.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3 border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No projects yet. <Link to="/projects/new" className="underline">Add one</Link>.
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
