import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ALL_PERSONA_IDS, PERSONAS, type PersonaId } from "@/lib/qa/personas";
import { createRun } from "@/lib/qa/runner";
import { startRun } from "@/lib/qa/runner";
import { ArrowLeft, Play } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSubscription, useRefreshUsage } from "@/lib/subscription";
import { recordRun } from "@/lib/subscription.functions";
import { PaywallCard, TrialBadge } from "@/components/PaywallCard";

export const Route = createFileRoute("/qa/new")({
  component: NewQaRun,
});

function NewQaRun() {
  const navigate = useNavigate();
  const sub = useSubscription();
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("quick");
  const [selected, setSelected] = useState<PersonaId[]>(["first_time", "accessibility", "frustrated"]);
  const [submitting, setSubmitting] = useState(false);

  function togglePersona(id: PersonaId) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || selected.length === 0 || submitting || !sub.canRun) return;
    setSubmitting(true);
    let normalized = url.trim();
    if (!/^https?:\/\//.test(normalized)) normalized = `https://${normalized}`;
    const run = createRun({ url: normalized, depth, personas: selected });
    if (!sub.active) incrementRunsUsed();
    void startRun(run.id);
    navigate({ to: "/qa/runs/$runId", params: { runId: run.id } });
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/qa" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to QA
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Start an autonomous crawl</h1>
          <TrialBadge />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Synapse QA OS will discover pages, scrape them, and inspect each one with every persona you select.
        </p>
      </div>

      {!sub.canRun && (
        <div className="mb-6 max-w-2xl">
          <PaywallCard what="run" />
        </div>
      )}

      <form onSubmit={onSubmit} className="max-w-2xl space-y-6 rounded-lg border border-border bg-card p-6">

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Target URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-app.com"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Depth
          </label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["quick", "standard", "deep"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDepth(d)}
                className={`rounded-md border px-3 py-2 text-sm capitalize ${
                  depth === d
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {d}
                <div className="text-[10px] text-muted-foreground">
                  {d === "quick" ? "≤3 pages" : d === "standard" ? "≤8 pages" : "≤20 pages"}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AI personas ({selected.length})
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ALL_PERSONA_IDS.map((id) => {
              const p = PERSONAS[id];
              const on = selected.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePersona(id)}
                  className={`rounded-md border p-3 text-left text-sm ${
                    on ? "border-primary bg-primary/10" : "border-input bg-background hover:bg-accent"
                  }`}
                >
                  <div className="font-medium">
                    {p.emoji} {p.name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{p.short}</div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={!url.trim() || selected.length === 0 || submitting || !sub.canRun}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Play className="h-4 w-4" /> {submitting ? "Starting..." : !sub.canRun ? "Upgrade to run" : "Start crawl"}
        </button>
        <p className="text-xs text-muted-foreground">
          Each page × persona uses one AI call. Quick + 3 personas ≈ 9 calls.
        </p>
      </form>
    </AppShell>
  );
}
