import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getRun, type QaFindingRow } from "@/lib/qa/qa.functions";
import { PERSONAS, type PersonaId } from "@/lib/qa/personas";
import { computeScore, verdictColor, verdictLabel } from "@/lib/qa/scoring";
import { analyzeFixRootCauses } from "@/lib/ai.functions";
import { ArrowLeft, ExternalLink, Wrench, Copy, X, Sparkles, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/qa/runs/$runId")({
  component: QaRunDetail,
});

function QaRunDetail() {
  const { runId } = Route.useParams();
  const [tab, setTab] = useState<"summary" | "findings" | "pages">("summary");
  const [showFixes, setShowFixes] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["qa-run", runId],
    queryFn: () => getRun({ data: { id: runId } }),
    refetchInterval: (q) => {
      const s = q.state.data?.run?.status;
      return s && s !== "completed" && s !== "failed" ? 2000 : false;
    },
  });

  const score = useMemo(() => {
    if (!data) return null;
    return computeScore(
      data.findings.map((f) => ({
        id: f.id,
        runId: f.run_id,
        personaId: f.persona_id as PersonaId,
        pageUrl: f.page_url,
        category: f.category,
        severity: f.severity,
        confidence: Number(f.confidence),
        title: f.title,
        detail: f.detail,
        suggestion: f.suggestion ?? undefined,
      })),
      data.pages.length,
      Math.max(data.pages.length, 1),
    );
  }, [data]);

  if (isLoading) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (!data) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Run not found.</p>
        <Link to="/qa" className="text-sm underline">Back</Link>
      </AppShell>
    );
  }

  const { run, pages, findings } = data;
  const inFlight = run.status !== "completed" && run.status !== "failed";

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/qa" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All runs
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{run.target_url}</h1>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(run.created_at).toLocaleString()} · {run.depth} crawl · {run.personas.length} personas
            </div>
          </div>
          {run.status === "completed" && score ? (
            <div className="flex items-start gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFixes(true)}
                disabled={findings.filter((f) => f.suggestion).length === 0}
              >
                <Wrench className="mr-1 h-4 w-4" /> Pull all fixes
              </Button>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Readiness</div>
                <div className="text-4xl font-semibold">{score.score}<span className="text-base text-muted-foreground">/100</span></div>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${verdictColor(score.verdict)}`}>
                  {verdictLabel(score.verdict)}
                </span>
              </div>
            </div>
          ) : (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600">
              {run.status}
            </span>
          )}
        </div>
      </div>

      {showFixes && run.status === "completed" && (
        <FixesBubble
          findings={findings}
          onClose={() => setShowFixes(false)}
        />
      )}

      {inFlight && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-medium">{run.progress_stage ?? run.status}</div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={run.progress_pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${run.progress_pct}%` }} />
          </div>
        </div>
      )}

      {run.status === "failed" && (
        <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700" role="alert">
          {run.error || "Run failed"}
        </div>
      )}

      {run.status === "completed" && run.warnings && run.warnings.length > 0 && (
        <details className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
          <summary className="cursor-pointer font-medium">
            {run.warnings.length} step{run.warnings.length === 1 ? "" : "s"} skipped due to transient errors
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
            {run.warnings.map((w, i) => (
              <li key={i} className="font-mono">{w}</li>
            ))}
          </ul>
        </details>
      )}

      <div role="tablist" className="mb-4 flex gap-1 border-b border-border">
        {(["summary", "findings", "pages"] as const).map((t) => {
          const label =
            t === "summary" ? "Summary" : t === "findings" ? `Findings (${findings.length})` : `Pages crawled (${pages.length})`;
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "summary" && score && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Functional" v={score.subscores.functional} />
          <Stat label="Visual" v={score.subscores.visual} />
          <Stat label="Accessibility" v={score.subscores.accessibility} />
          <Stat label="Coverage" v={score.subscores.coverage} />
          <div className="sm:col-span-4 rounded-lg border border-border bg-card p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Findings by severity</div>
            <div className="flex flex-wrap gap-3 text-sm">
              <SevPill label="Critical" n={score.counts.critical} cls="bg-rose-500/15 text-rose-700" />
              <SevPill label="High" n={score.counts.high} cls="bg-orange-500/15 text-orange-700" />
              <SevPill label="Medium" n={score.counts.medium} cls="bg-amber-500/15 text-amber-700" />
              <SevPill label="Low" n={score.counts.low} cls="bg-blue-500/15 text-blue-700" />
            </div>
          </div>
        </div>
      )}

      {tab === "findings" && (
        <div className="space-y-2">
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings yet.</p>
          ) : (
            findings
              .slice()
              .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
              .map((f) => <FindingCard key={f.id} f={f} />)
          )}
        </div>
      )}

      {tab === "pages" && (
        <div className="space-y-2">
          {pages.length === 0 && <p className="text-sm text-muted-foreground">No pages crawled yet.</p>}
          {pages.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-sm font-medium hover:underline">
                  {p.title || p.url} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
                <span className="text-xs text-muted-foreground">{p.links.length} links</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{p.url}</div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{v}</div>
    </div>
  );
}

function SevPill({ label, n, cls }: { label: string; n: number; cls: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}: {n}</span>;
}

function sevRank(s: string) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s as "critical"] ?? 0;
}

function FindingCard({ f }: { f: QaFindingRow }) {
  const persona = PERSONAS[f.persona_id as PersonaId];
  const sevClass = {
    critical: "bg-rose-500/15 text-rose-700",
    high: "bg-orange-500/15 text-orange-700",
    medium: "bg-amber-500/15 text-amber-700",
    low: "bg-blue-500/15 text-blue-700",
  }[f.severity];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sevClass}`}>{f.severity}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">{f.category}</span>
        {persona && (
          <span className="text-xs text-muted-foreground">{persona.emoji} {persona.name}</span>
        )}
        <span className="text-xs text-muted-foreground">· {Math.round(Number(f.confidence) * 100)}% conf</span>
      </div>
      <div className="mt-1.5 text-sm font-medium">{f.title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
      {f.suggestion && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Suggested fix: </span>
          <span className="text-muted-foreground">{f.suggestion}</span>
        </p>
      )}
      <a href={f.page_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline">
        {f.page_url} <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}

function FixesBubble({ findings, onClose }: { findings: QaFindingRow[]; onClose: () => void }) {
  const withFix = findings.filter((f) => f.suggestion);
  const sorted = withFix.slice().sort((a, b) => sevRank(b.severity) - sevRank(a.severity));

  const asText = useMemo(
    () =>
      sorted
        .map(
          (f, i) =>
            `${i + 1}. [${f.severity.toUpperCase()}] ${f.title}\n   Page: ${f.page_url}\n   Fix: ${f.suggestion}`,
        )
        .join("\n\n"),
    [sorted],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText);
      toast.success(`Copied ${sorted.length} fix${sorted.length === 1 ? "" : "es"}`);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Suggested fixes ({sorted.length})</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={copy}>
            <Copy className="mr-1 h-4 w-4" /> Copy all
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suggested fixes in this run.</p>
      ) : (
        <ol className="space-y-2">
          {sorted.map((f, i) => (
            <li key={f.id} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-xs text-muted-foreground">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{f.title}</div>
                  <div className="mt-0.5 text-muted-foreground">{f.suggestion}</div>
                  <a
                    href={f.page_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline"
                  >
                    {f.page_url} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
