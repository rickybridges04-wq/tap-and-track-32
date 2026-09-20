// Pre-fills a bug draft from an AI failure analysis. The user always confirms before it saves.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bug as BugIcon } from "lucide-react";
import { toast } from "sonner";
import { createBug, BUG_SEVERITIES, type BugSeverity } from "@/lib/bugs.functions";

export type BugDraft = {
  title: string;
  severity: BugSeverity;
  steps: string[];
  expected: string;
  actual: string;
  likelyCause: string;
  projectId: string | null;
  resultId: string | null;
  analysisId: string | null;
  screenshotPath: string | null;
};

export function CreateBugDialog({ draft }: { draft: BugDraft }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(draft.title);
  const [severity, setSeverity] = useState<BugSeverity>(draft.severity);
  const [steps, setSteps] = useState(draft.steps.join("\n"));
  const [expected, setExpected] = useState(draft.expected);
  const [actual, setActual] = useState(draft.actual);
  const [cause, setCause] = useState(draft.likelyCause);

  async function save() {
    setSaving(true);
    try {
      const { id } = await createBug({
        data: {
          project_id: draft.projectId,
          result_id: draft.resultId,
          failure_analysis_id: draft.analysisId,
          title: title.trim().slice(0, 300),
          severity,
          steps_to_reproduce: steps
            .split("\n")
            .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
            .filter(Boolean)
            .slice(0, 50),
          expected: expected.trim() || null,
          actual: actual.trim() || null,
          likely_cause: cause.trim() || null,
          screenshot_path: draft.screenshotPath,
        },
      });
      toast.success("Bug created");
      setOpen(false);
      navigate({ to: "/bugs/$bugId", params: { bugId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the bug");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <BugIcon className="mr-1 h-3.5 w-3.5" /> Create bug
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New bug</DialogTitle>
          <DialogDescription>
            Pre-filled from the measured failure and the AI suggestion. Edit anything, then confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Severity">
            <div className="flex flex-wrap gap-2">
              {BUG_SEVERITIES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={severity === s ? "default" : "outline"}
                  onClick={() => setSeverity(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Steps to reproduce (one per line)">
            <Textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} />
          </Field>
          <Field label="Expected">
            <Textarea rows={2} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </Field>
          <Field label="Actual">
            <Textarea rows={2} value={actual} onChange={(e) => setActual(e.target.value)} />
          </Field>
          <Field label="Likely cause (Suggestion — AI)">
            <Textarea rows={3} value={cause} onChange={(e) => setCause(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={saving || !title.trim()} onClick={save}>
            {saving ? "Saving…" : "Create bug"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
