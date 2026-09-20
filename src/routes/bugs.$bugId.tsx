import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrashButton } from "@/components/TrashButton";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Github } from "lucide-react";
import {
  getBug,
  updateBug,
  deleteBug,
  addBugComment,
  openGithubIssue,
  BUG_STATUSES,
  BUG_SEVERITIES,
} from "@/lib/bugs.functions";
import { useSecret } from "@/lib/secrets-store";
import { severityClass, statusClass } from "./bugs.index";

export const Route = createFileRoute("/bugs/$bugId")({
  head: () => ({
    meta: [
      { title: "Bug detail · Synapse QA OS" },
      {
        name: "description",
        content:
          "One bug: reproduction steps, expected versus actual behaviour, the AI's likely cause, comments and status.",
      },
      { property: "og:title", content: "Bug detail · Synapse QA OS" },
      { property: "og:description", content: "Reproduction steps, evidence and status for one bug." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BugDetail,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="text-sm text-destructive">Could not load this bug: {error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Bug not found.</p>
    </AppShell>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  wontfix: "Won't fix",
};

function BugDetail() {
  const { bugId } = Route.useParams();
  const qc = useQueryClient();
  const repo = useSecret("GITHUB_REPO");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["bug", bugId],
    queryFn: () => getBug({ data: { id: bugId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["bug", bugId] });

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
        <p className="text-sm text-muted-foreground">Bug not found.</p>
      </AppShell>
    );
  }

  const { bug, comments, screenshotUrl } = data;
  const steps = Array.isArray(bug.steps_to_reproduce) ? (bug.steps_to_reproduce as string[]) : [];

  async function patch(patchData: {
    id: string;
    status?: (typeof BUG_STATUSES)[number];
    severity?: (typeof BUG_SEVERITIES)[number];
    assignee?: string | null;
    title?: string;
  }) {

    setBusy(true);
    try {
      await updateBug({ data: patchData });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the bug");
    } finally {
      setBusy(false);
    }
  }

  async function fileOnGithub() {
    if (!repo) {
      toast.error("Set a GitHub repository in Settings first (owner/repo).");
      return;
    }
    setBusy(true);
    try {
      const res = await openGithubIssue({ data: { bug_id: bug.id, repo } });
      if (res.ok) {
        toast.success("GitHub issue created");
        await refresh();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reach GitHub");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <Link to="/bugs" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 h-3.5 w-3.5" /> All bugs
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{bug.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Filed {new Date(bug.created_at).toLocaleString()}
            {bug.assignee ? ` · assigned to ${bug.assignee}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${severityClass(bug.severity)}`}>
            {bug.severity}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(bug.status)}`}>
            {STATUS_LABEL[bug.status]}
          </span>
          <TrashButton
            label={`Delete bug ${bug.title}`}
            confirm="Delete this bug and its comments?"
            onDelete={async () => {
              await deleteBug({ data: { id: bug.id } });
              toast.success("Bug deleted");
              window.location.href = "/bugs";
            }}
          />
        </div>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {BUG_STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                disabled={busy}
                variant={bug.status === s ? "default" : "outline"}
                onClick={() => patch({ id: bug.id, status: s })}
              >
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {BUG_SEVERITIES.map((s) => (
              <Button
                key={s}
                size="sm"
                disabled={busy}
                variant={bug.severity === s ? "secondary" : "ghost"}
                onClick={() => patch({ id: bug.id, severity: s })}
              >
                {s}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Assignee"
              defaultValue={bug.assignee ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (bug.assignee ?? "")) patch({ id: bug.id, assignee: v || null });
              }}
            />
            {bug.github_issue_url ? (
              <Button asChild size="sm" variant="outline">
                <a href={bug.github_issue_url} target="_blank" rel="noreferrer">
                  View GitHub issue <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy} onClick={fileOnGithub}>
                <Github className="mr-1 h-3.5 w-3.5" /> Open GitHub issue
              </Button>
            )}
          </div>
          {!repo && (
            <p className="text-xs text-muted-foreground">
              GitHub is optional. Set a repository in Settings and add a GITHUB_TOKEN secret to enable it.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Block title="Steps to reproduce">
            {steps.length ? (
              <ol className="list-decimal space-y-0.5 pl-5">
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            ) : (
              <span className="text-muted-foreground">None recorded.</span>
            )}
          </Block>
          <Block title="Expected">{bug.expected ?? <span className="text-muted-foreground">—</span>}</Block>
          <Block title="Actual">{bug.actual ?? <span className="text-muted-foreground">—</span>}</Block>
          <Block title="Likely cause (Suggestion — AI)">
            {bug.likely_cause ?? <span className="text-muted-foreground">—</span>}
          </Block>
          {screenshotUrl && (
            <Block title="Screenshot">
              <img
                src={screenshotUrl}
                alt={`Screenshot captured when "${bug.title}" was found`}
                className="max-h-96 rounded-md border border-border"
              />
            </Block>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Comments ({comments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-3 text-sm">
              <div className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
              <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
            </div>
          ))}
          <Textarea
            rows={3}
            placeholder="Add a comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button
            size="sm"
            disabled={busy || !comment.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await addBugComment({ data: { bug_id: bug.id, body: comment.trim() } });
                setComment("");
                await refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not add the comment");
              } finally {
                setBusy(false);
              }
            }}
          >
            Comment
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1 whitespace-pre-wrap">{children}</div>
    </div>
  );
}
