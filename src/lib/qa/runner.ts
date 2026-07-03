// Synapse QA OS — client-side orchestrator. Persists every tick to Supabase.
import { mapSite, scrapePage } from "@/lib/qa/crawler.functions";
import { inspectPage } from "@/lib/qa/inspector.functions";
import { PERSONAS, type PersonaId } from "@/lib/qa/personas";
import { computeScore } from "@/lib/qa/scoring";
import { addFindings, addPage, patchRun } from "@/lib/qa/qa.functions";
import { DEPTH_LIMITS, type Depth } from "@/lib/qa/config";

type FindingLite = {
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
};

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
    });

    const pages: PageLite[] = [];
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      const pct = 15 + Math.round(((i + 1) / urls.length) * 35);
      const skipped = warnings.length ? `, ${warnings.length} skipped` : "";
      await patch({ progress_pct: pct, progress_stage: `Scraping ${i + 1}/${urls.length}${skipped}` });
      try {
        const scraped = await withRetry(
          () => scrapePage({ data: { url: u, withScreenshot: false } }),
          `scrape ${u}`,
        );
        if (scraped.ok) {
          pages.push({
            url: scraped.page.url,
            title: scraped.page.title,
            links: scraped.page.links,
            markdownPreview: scraped.page.markdownPreview,
          });
          await addPage({
            data: {
              run_id: runId,
              url: scraped.page.url,
              title: scraped.page.title ?? null,
              status: scraped.page.status ?? null,
              links: scraped.page.links,
              markdown_preview: scraped.page.markdownPreview ?? null,
            },
          }).catch(() => {});
        } else {
          warnings.push(`scrape ${u}: ${scraped.error}`);
          await patch({ warnings: [...warnings] });
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : String(err));
        await patch({ warnings: [...warnings] });
      }
    }

    if (pages.length === 0) throw new Error("No pages could be scraped");

    await patch({
      status: "inspecting",
      progress_pct: 55,
      progress_stage: "AI personas inspecting pages",
    });

    const collected: FindingLite[] = [];
    const total = pages.length * personas.length;
    let done = 0;
    let succeeded = 0;

    for (const page of pages) {
      for (const personaId of personas) {
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
                  },
                },
              }),
            `inspect ${personaId} ${page.url}`,
          );
          if (res.ok) {
            succeeded++;
            const batch: FindingLite[] = res.findings.map((f) => ({
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
        const pct = 55 + Math.round((done / Math.max(1, total)) * 40);
        const skipped = warnings.length ? `, ${warnings.length} skipped` : "";
        await patch({
          progress_pct: pct,
          progress_stage: `Inspecting ${PERSONAS[personaId].name} (${done}/${total}${skipped})`,
          warnings: [...warnings],
        });
      }
    }

    if (succeeded === 0) throw new Error("All inspections failed");

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
      })),
      pages.length,
      Math.max(pages.length, 1),
    );

    await patch({
      status: "completed",
      progress_pct: 100,
      progress_stage: "Complete",
      score: score.score,
      verdict: score.verdict,
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
