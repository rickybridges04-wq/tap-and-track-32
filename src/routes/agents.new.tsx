import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RunAgentDialog } from "@/components/RunAgentDialog";
import { Button } from "@/components/ui/button";
import { AGENTS } from "@/lib/agents";

export const Route = createFileRoute("/agents/new")({
  head: () => ({ meta: [{ title: "New agent task · Bridges Ops" }] }),
  component: NewTask,
});

function NewTask() {
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">New agent task</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick any agent or let the router decide.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(AGENTS).map((a) => (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span>{a.emoji}</span>
                <span className={a.color}>{a.name}</span>
              </CardTitle>
              <CardDescription>{a.short}</CardDescription>
            </CardHeader>
            <CardContent>
              <RunAgentDialog
                defaultAgent={a.id}
                trigger={<Button size="sm" variant="outline" className="w-full">Run {a.name}</Button>}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Or describe the problem</CardTitle>
          <CardDescription>The router picks the right agent from your description.</CardDescription>
        </CardHeader>
        <CardContent>
          <RunAgentDialog />
        </CardContent>
      </Card>
    </AppShell>
  );
}
