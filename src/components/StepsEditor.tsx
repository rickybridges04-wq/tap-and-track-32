import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  DEFAULT_TIMEOUT_MS,
  STEP_ACTIONS,
  STEP_FIELDS,
  STEP_LABELS,
  StepsSchema,
  type Step,
  type StepAction,
} from "@/lib/qa/steps";

export function StepsEditor({
  steps,
  onChange,
}: {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}) {
  const [jsonMode, setJsonMode] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(steps, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Step>) =>
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i: number, dir: -1 | 1) => {
    const next = [...steps];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const applyJson = () => {
    try {
      const parsed = StepsSchema.parse(JSON.parse(draft));
      onChange(parsed);
      setJsonError(null);
      setJsonMode(false);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Steps
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(JSON.stringify(steps, null, 2));
            setJsonError(null);
            setJsonMode((v) => !v);
          }}
        >
          {jsonMode ? "Visual view" : "JSON view"}
        </Button>
      </div>

      {jsonMode ? (
        <div className="space-y-2">
          <Textarea
            rows={12}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono text-xs"
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          <Button type="button" size="sm" onClick={applyJson}>
            Apply JSON
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, i) => {
            const fields = STEP_FIELDS[step.action];
            return (
              <div key={i} className="rounded-md border border-border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 text-xs text-muted-foreground">{i}</span>
                  <select
                    aria-label={`Step ${i} action`}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={step.action}
                    onChange={(e) => update(i, { action: e.target.value as StepAction })}
                  >
                    {STEP_ACTIONS.map((a) => (
                      <option key={a} value={a}>
                        {STEP_LABELS[a]}
                      </option>
                    ))}
                  </select>
                  {fields.selector && (
                    <Input
                      aria-label={`Step ${i} selector`}
                      placeholder="selector e.g. role=button[name='Sign in']"
                      className="h-8 flex-1 text-xs"
                      value={step.selector ?? ""}
                      onChange={(e) => update(i, { selector: e.target.value })}
                    />
                  )}
                  {fields.value && (
                    <Input
                      aria-label={`Step ${i} value`}
                      placeholder="value"
                      className="h-8 w-40 text-xs"
                      value={step.value ?? ""}
                      onChange={(e) => update(i, { value: e.target.value })}
                    />
                  )}
                  <Input
                    aria-label={`Step ${i} timeout in milliseconds`}
                    type="number"
                    className="h-8 w-24 text-xs"
                    placeholder={String(DEFAULT_TIMEOUT_MS)}
                    value={step.timeout_ms ?? ""}
                    onChange={(e) =>
                      update(i, {
                        timeout_ms: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" aria-label="Move step up" onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" aria-label="Move step down" onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Delete step"
                      onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...steps, { action: "goto", value: "/" }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add step
          </Button>
        </div>
      )}
    </div>
  );
}
