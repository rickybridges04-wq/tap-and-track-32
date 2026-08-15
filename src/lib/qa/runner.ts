// Synapse QA OS — client-side orchestrator. Persists every tick to Supabase.
import { mapSite, scrapePage } from "@/lib/qa/crawler.functions";
import { inspectPage } from "@/lib/qa/inspector.functions";
import { PERSONAS, type PersonaId } from "@/lib/qa/personas";
import { computeScore } from "@/lib/qa/scoring";
import { addFindings, addPage, patchRun } from "@/lib/qa/qa.functions";
import { DEPTH_LIMITS, type Depth } from "@/lib/qa/config";

type FindingLite = {
  basis: "observed" | "inferred";
  persona_id: string;
  page_url: string;
  category: "functional" | "visual" | "accessibility" | "performance";
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  title: string;
  detail: string;
  suggestion?: string;
};

type PageLite = {
  url: string;
  title?: string;
  links: string[];
  markdownPreview?: string;
  screenshotUrl?: string;
  latencyMs?: number;
  truncated?: boolean;
};

// Real, measured performance evidence — not a model guess.
const SLOW_MS = 2500;
const VERY_SLOW_MS = 6000;

function perfFindings(page: PageLite): FindingLite[] {
  const ms = page.latencyMs;
  if (ms == null || ms < SLOW_MS) return [];
  return [
    {
      basis: "observed",
      persona_id: "measurement",
      page_url: page.url,
      category: "performance",
      severity: ms >= VERY_SLOW_MS ? "high" : "medium",
      confidence: 1,
      title: `Page responded in ${(ms / 1000).toFixed(1)}s`,
      detail: `Measured server response time for ${page.url} was ${ms}ms, above the ${SLOW_MS}ms threshold. This is a real timing measurement, not an inference.`,
      suggestion: "Check server response time, payload size and any blocking upstream calls for this route.",
    },
  ];
}

const AUTH_WALL_RE = /\b(sign in|sign up|log in|login|create account|password)\b/i;

function looksLikeAuthWall(page: PageLite): boolean {
  const md = page.markdownPreview ?? "";
  return md.length < 900 && AUTH_WALL_RE.test(md);
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [500, 1500];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < delays.length) await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw new Error(`${label}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

// Bounded-concurrency map. Preserves input order in results.
async function pMap<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

const SCRAPE_CONCURRENCY = 5;
const INSPECT_CONCURRENCY = 6;

export async function runQa(input: {
  id: string;
  url: string;
  depth: Depth;
  personas: PersonaId[];
}) {
  const { id: runId, url, depth, personas } = input;
  const warnings: string[] = [];

  const patch = (p: Record<string, unknown>) =>
    patchRun({ data: { id: runId, ...p } }).catch(() => {});

  try {
    await patch({ status: "mapping", progress_pct: 5, progress_stage: "Discovering URLs" });
    const limit = DEPTH_LIMITS[depth];
    const mapped = await withRetry(() => mapSite({ data: { url, limit } }), "map");
    if (!mapped.ok) throw new Error(`Map failed: ${mapped.error}`);

    let urls = mapped.links.length ? mapped.links : [url];
    if (!urls.includes(url)) urls = [url, ...urls];
    urls = urls.slice(0, limit);

    await patch({
      status: "scraping",
      progress_pct: 15,
      progress_stage: `Found ${urls.length} pages`,
      pages_discovered: urls.length,
    });

    const pages: PageLite[] = [];
    let scrapeDone = 0;
    await pMap(urls, SCRAPE_CONCURRENCY, async (u) => {
      try {
        const scraped = await withRetry(
          () => scrapePage({ data: { url: u, withScreenshot: true } }),
          `scrape ${u}`,
        );
        if (scraped.ok) {
          pages.push({
            url: scraped.page.url,
            title: scraped.page.title,
            links: scraped.page.links,
            markdownPreview: scraped.page.markdownPreview,
            screenshotUrl: scraped.page.screenshotUrl,
            latencyMs: scraped.page.latencyMs,
            truncated: scraped.page.truncated,
          });
          await addPage({
            data: {
              run_id: runId,
              url: scraped.page.url,
              title: scraped.page.title ?? null,
              status: scraped.page.status ?? null,
              links: scraped.page.links,
              markdown_preview: scraped.page.markdownPreview ?? null,
              screenshot_url: scraped.page.screenshotUrl ?? null,
              latency_ms: scraped.page.latencyMs ?? null,
              truncated: scraped.page.truncated ?? false,
            },
          }).catch(() => {});
        } else {
          warnings.push(`scrape ${u}: ${scraped.error}`);
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : String(err));
      }
      scrapeDone++;
      const pct = 15 + Math.round((scrapeDone / urls.length) * 35);
      const skipped = warnings.length ? `, ${warnings.length} skipped` : "";
      await patch({
        progress_pct: pct,
        progress_stage: `Scraping ${scrapeDone}/${urls.length}${skipped}`,
        warnings: [...warnings],
      });
    });

    if (pages.length === 0) throw new Error("No pages could be scraped");

    await patch({
      status: "inspecting",
      progress_pct: 55,
      progress_stage: "AI personas inspecting pages",
    });

    const collected: FindingLite[] = [];
    type Job = { page: PageLite; personaId: PersonaId };
    const jobs: Job[] = [];
    for (const page of pages) for (const personaId of personas) jobs.push({ page, personaId });

    let done = 0;
    let succeeded = 0;

    await pMap(jobs, INSPECT_CONCURRENCY, async ({ page, personaId }) => {
      try {
        const res = await withRetry(
          () =>
            inspectPage({
              data: {
                personaId,
                page: {
                  url: page.url,
                  title: page.title,
                  links: page.links,
                  markdownPreview: page.markdownPreview ?? "",
                  screenshotUrl: page.screenshotUrl ?? null,
                  latencyMs: page.latencyMs ?? null,
                  truncated: page.truncated ?? false,
                },
              },
            }),
          `inspect ${personaId} ${page.url}`,
        );
        if (res.ok) {
          succeeded++;
          const batch: FindingLite[] = res.findings.map((f) => ({
            basis: f.basis ?? "inferred",
            persona_id: personaId,
            page_url: page.url,
            category: f.category,
            severity: f.severity,
            confidence: f.confidence,
            title: f.title,
            detail: f.detail,
            suggestion: f.suggestion,
          }));
          if (batch.length) {
            collected.push(...batch);
            await addFindings({ data: { run_id: runId, findings: batch } }).catch(() => {});
          }
        } else {
          warnings.push(`inspect ${personaId} ${page.url}: ${res.error}`);
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : String(err));
      }
      done++;
      const pct = 55 + Math.round((done / Math.max(1, jobs.length)) * 40);
      const skipped = warnings.length ? `, ${warnings.length} skipped` : "";
      await patch({
        progress_pct: pct,
        progress_stage: `Inspecting ${PERSONAS[personaId].name} (${done}/${jobs.length}${skipped})`,
        warnings: [...warnings],
      });
    });

    if (succeeded === 0) throw new Error("All inspections failed");

    // Measured performance evidence, one per slow page.
    const measured = pages.flatMap(perfFindings);
    if (measured.length) {
      collected.push(...measured);
      await addFindings({ data: { run_id: runId, findings: measured } }).catch(() => {});
    }

    const authWalled = pages.length > 0 && pages.every(looksLikeAuthWall);
    if (authWalled) {
      warnings.push(
        "Every page reached looks like a sign-in wall — the crawler never saw the app behind auth, so this score covers the public shell only.",
      );
    }

    const score = computeScore(
      collected.map((f) => ({
        id: "",
        runId,
        personaId: f.persona_id as PersonaId,
        pageUrl: f.page_url,
        category: f.category,
        severity: f.severity,
        confidence: f.confidence,
        title: f.title,
        detail: f.detail,
        suggestion: f.suggestion,
        basis: f.basis,
      })),
      pages.length,
      Math.max(urls.length, 1),
      personas.length,
    );

    await patch({
      status: "completed",
      progress_pct: 100,
      progress_stage: "Complete",
      score: score.score,
      verdict: authWalled && score.verdict === "ready" ? "minor" : score.verdict,
      pages_scraped: pages.length,
      pages_discovered: urls.length,
      warnings: [...warnings],
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    await patch({
      status: "failed",
      progress_pct: 100,
      progress_stage: "Failed",
      error: err instanceof Error ? err.message : String(err),
      warnings: [...warnings],
      completed_at: new Date().toISOString(),
    });
  }
}
