// Synapse QA OS — client-side run orchestrator.
// Drives map → scrape → inspect across pages × personas, updating localStorage as it goes.
import { mapSite, scrapePage } from "@/lib/qa/crawler.functions";
import { inspectPage } from "@/lib/qa/inspector.functions";
import { PERSONAS, type PersonaId } from "@/lib/qa/personas";
import { computeScore } from "@/lib/qa/scoring";
import {
  getRun,
  qaid,
  saveRun,
  type QaFinding,
  type QaPage,
  type QaRun,
} from "@/lib/qa/qa-store";

const DEPTH_LIMITS = {
  quick: 3,
  standard: 8,
  deep: 20,
} as const;

export function createRun(input: {
  url: string;
  depth: "quick" | "standard" | "deep";
  personas: PersonaId[];
}): QaRun {
  const run: QaRun = {
    id: qaid("run"),
    url: input.url,
    depth: input.depth,
    personas: input.personas,
    status: "pending",
    progress: { stage: "Queued", pct: 0 },
    pages: [],
    findings: [],
    createdAt: new Date().toISOString(),
  };
  saveRun(run);
  return run;
}

function patch(runId: string, patch: Partial<QaRun>) {
  const cur = getRun(runId);
  if (!cur) return;
  saveRun({ ...cur, ...patch });
}

export async function startRun(runId: string) {
  const run = getRun(runId);
  if (!run) return;

  try {
    // 1. Map the site
    patch(runId, { status: "mapping", progress: { stage: "Discovering URLs", pct: 5 } });
    const limit = DEPTH_LIMITS[run.depth];
    const mapped = await mapSite({ data: { url: run.url, limit } });
    if (!mapped.ok) throw new Error(`Map failed: ${mapped.error}`);

    let urls = mapped.links.length ? mapped.links : [run.url];
    if (!urls.includes(run.url)) urls = [run.url, ...urls];
    urls = urls.slice(0, limit);

    patch(runId, {
      status: "scraping",
      progress: { stage: `Found ${urls.length} pages`, pct: 15 },
    });

    // 2. Scrape each page
    const pages: QaPage[] = [];
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      const pct = 15 + Math.round(((i + 1) / urls.length) * 35);
      patch(runId, { progress: { stage: `Scraping ${i + 1}/${urls.length}`, pct } });
      const scraped = await scrapePage({ data: { url: u, withScreenshot: false } });
      if (scraped.ok) pages.push(scraped.page);
    }
    patch(runId, { pages });

    // 3. Inspect each page with each persona
    patch(runId, {
      status: "inspecting",
      progress: { stage: "AI personas inspecting pages", pct: 55 },
    });

    const findings: QaFinding[] = [];
    const total = pages.length * run.personas.length;
    let done = 0;

    for (const page of pages) {
      for (const personaId of run.personas) {
        const res = await inspectPage({
          data: {
            personaId,
            page: {
              url: page.url,
              title: page.title,
              links: page.links,
              markdownPreview: page.markdownPreview ?? "",
            },
          },
        });
        if (res.ok) {
          for (const f of res.findings) {
            findings.push({
              id: qaid("f"),
              runId,
              personaId,
              pageUrl: page.url,
              category: f.category,
              severity: f.severity,
              confidence: f.confidence,
              title: f.title,
              detail: f.detail,
              suggestion: f.suggestion,
            });
          }
        }
        done++;
        const pct = 55 + Math.round((done / Math.max(1, total)) * 40);
        patch(runId, {
          findings: [...findings],
          progress: {
            stage: `Inspecting ${PERSONAS[personaId].name} (${done}/${total})`,
            pct,
          },
        });
      }
    }

    // 4. Score
    const score = computeScore(findings, pages.length, urls.length);
    patch(runId, {
      status: "completed",
      progress: { stage: "Complete", pct: 100 },
      findings,
      score: score.score,
      verdict: score.verdict,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    patch(runId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      progress: { stage: "Failed", pct: 100 },
      completedAt: new Date().toISOString(),
    });
  }
}
