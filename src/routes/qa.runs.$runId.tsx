import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQaRun, useMounted, type QaFinding } from "@/lib/qa/qa-store";
import { PERSONAS, type PersonaId } from "@/lib/qa/personas";
import { computeScore, verdictColor, verdictLabel } from "@/lib/qa/scoring";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/qa/runs/$runId")({
  component: QaRunDetail,
});

function QaRunDetail() {
  const { runId } = Route.useParams();
  const mounted = useMounted();
  const run = useQaRun(runId);
  const [tab, setTab] = useState<"summary" | "findings" | "pages">("summary");

  const score = useMemo(() => {
    if (!run) return null;
    return computeScore(run.findings, run.pages.length, Math.max(run.pages.length, 1));
  }, [run]);

  if (!mounted) return <AppShell><div /></AppShell>;
  if (!run) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Run not found.</p>
        <Link to="/qa" className="text-sm underline">Back</Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/qa" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All runs
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{run.url}</h1>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(run.createdAt).toLocaleString()} · {run.depth} crawl · {run.personas.length} personas
            </div>
          </div>
          {run.status === "completed" && score ? (
            <div className="text-right" aria-label={`Release readiness score ${score.score} out of 100, ${verdictLabel(score.verdict)}`}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Readiness</div>
              <div className="text-4xl font-semibold">{score.score}<span className="text-base text-muted-foreground">/100</span></div>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${verdictColor(score.verdict)}`}>
                {verdictLabel(score.verdict)}
              </span>
            </div>
          ) : (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600" aria-label={`Run status: ${run.status}`}>
              {run.status}
            </span>
          )}
        </div>
      </div>

      {run.status !== "completed" && run.status !== "failed" && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="text-sm font-medium">{run.progress.stage}</div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={run.progress.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Crawl progress: ${run.progress.stage}`}
          >
            <div className="h-full bg-primary transition-all" style={{ width: `${run.progress.pct}%` }} />
          </div>
        </div>
      )}

      {run.status === "failed" && (
        <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700" role="alert">
          {run.error || "Run failed"}
        </div>
      )}

      <div role="tablist" aria-label="Run report sections" className="mb-4 flex gap-1 border-b border-border">
        {(["summary", "findings", "pages"] as const).map((t) => {
          const tabLabel =
            t === "summary" ? "Summary" : t === "findings" ? `Findings (${run.findings.length})` : `Pages crawled (${run.pages.length})`;
          const isActive = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              id={`qa-tab-${t}`}
              aria-selected={isActive}
              aria-controls={`qa-panel-${t}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tabLabel}
            </button>
          );
        })}
      </div>


      {tab === "summary" && score && (
        <div role="tabpanel" id="qa-panel-summary" aria-labelledby="qa-tab-summary" className="grid gap-3 sm:grid-cols-4">
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
        <div role="tabpanel" id="qa-panel-findings" aria-labelledby="qa-tab-findings" className="space-y-2">
          {run.findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings yet.</p>
          ) : (
            run.findings
              .slice()
              .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
              .map((f) => <FindingCard key={f.id} f={f} />)
          )}
        </div>
      )}

      {tab === "pages" && (
        <div role="tabpanel" id="qa-panel-pages" aria-labelledby="qa-tab-pages" className="space-y-2">
          {run.pages.length === 0 && (
            <p className="text-sm text-muted-foreground">No pages crawled yet.</p>
          )}
          {run.pages.map((p) => (
            <div key={p.url} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${p.title || p.url} in new tab`}
                  className="flex items-center gap-1 truncate text-sm font-medium hover:underline"
                >
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
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
      {label}: {n}
    </span>
  );
}

function sevRank(s: string) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s as "critical"] ?? 0;
}

function FindingCard({ f }: { f: QaFinding }) {
  const persona = f.personaId !== "crawler" ? PERSONAS[f.personaId as PersonaId] : null;
  const sevClass = {
    critical: "bg-rose-500/15 text-rose-700",
    high: "bg-orange-500/15 text-orange-700",
    medium: "bg-amber-500/15 text-amber-700",
    low: "bg-blue-500/15 text-blue-700",
  }[f.severity];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sevClass}`}>
              {f.severity}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">
              {f.category}
            </span>
            {persona && (
              <span className="text-xs text-muted-foreground">
                {persona.emoji} {persona.name}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              · {Math.round((f.confidence || 0) * 100)}% conf
            </span>
          </div>
          <div className="mt-1.5 text-sm font-medium">{f.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
          {f.suggestion && (
            <p className="mt-2 text-sm">
              <span className="font-medium">Suggested fix: </span>
              <span className="text-muted-foreground">{f.suggestion}</span>
            </p>
          )}
        </div>
      </div>
      <a href={f.pageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 truncate text-xs text-muted-foreground hover:underline">
        {f.pageUrl} <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
