import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listBugs, BUG_STATUSES, type BugStatus } from "@/lib/bugs.functions";

export const Route = createFileRoute("/bugs/")({
  head: () => ({
    meta: [
      { title: "Bugs · Synapse QA OS" },
      {
        name: "description",
        content:
          "Bugs filed from real browser test failures, with severity, status, reproduction steps and the AI's likely cause.",
      },
      { property: "og:title", content: "Bugs · Synapse QA OS" },
      { property: "og:description", content: "Track bugs filed from measured test failures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BugsList,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-destructive">Could not load bugs: {error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
});

const STATUS_LABEL: Record<BugStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  wontfix: "Won't fix",
};

export function statusClass(status: string) {
  if (status === "open") return "bg-rose-500/15 text-rose-600";
  if (status === "in_progress") return "bg-blue-500/15 text-blue-600";
  if (status === "resolved") return "bg-emerald-500/15 text-emerald-600";
  return "bg-muted text-muted-foreground";
}

export function severityClass(severity: string) {
  if (severity === "critical") return "bg-rose-600/15 text-rose-700";
  if (severity === "high") return "bg-orange-500/15 text-orange-600";
  if (severity === "medium") return "bg-amber-500/15 text-amber-600";
  return "bg-muted text-muted-foreground";
}

function BugsList() {
  const [filter, setFilter] = useState<BugStatus | "all">("all");
  const { data, isLoading } = useQuery({ queryKey: ["bugs"], queryFn: () => listBugs() });

  const bugs = (data ?? []).filter((b) => filter === "all" || b.status === filter);

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Bugs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Filed from measured test failures. The browser decided the failure; the AI only suggested a cause.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All ({data?.length ?? 0})
        </Button>
        {BUG_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {STATUS_LABEL[s]} ({(data ?? []).filter((b) => b.status === s).length})
          </Button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && bugs.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No bugs here. Create one from a failure on an automated run.
            </CardContent>
          </Card>
        )}
        {bugs.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  <Link to="/bugs/$bugId" params={{ bugId: b.id }} className="hover:underline">
                    {b.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {new Date(b.created_at).toLocaleString()}
                  {b.assignee ? ` · ${b.assignee}` : ""}
                  {b.github_issue_url ? " · GitHub issue open" : ""}
                </CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${severityClass(b.severity)}`}>
                  {b.severity}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(b.status)}`}>
                  {STATUS_LABEL[b.status]}
                </span>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
