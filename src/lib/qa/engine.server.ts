// Walkthrough Wizard QAOS — server-side QA run engine.
// Runs advance in bounded "ticks" so they survive the browser tab closing.
// Each tick: lease the run, do ~25s of work, save the cursor, release, and
// ask the database (pg_net) to call the tick route again until done.
import { mapSite, scrapePage } from "@/lib/qa/crawler.server";
import { inspectPage } from "@/lib/qa/inspector.server";
import { PERSONAS, type PersonaId } from "@/lib/qa/personas";
import { computeScore } from "@/lib/qa/scoring";
import { DEPTH_LIMITS, type Depth } from "@/lib/qa/config";

const TICK_BUDGET_MS = 25_000;
const LEASE_MS = 90_000;
const SCRAPE_BATCH = 5;
const INSPECT_BATCH = 6;
const SLOW_MS = 2500;
const VERY_SLOW_MS = 6000;
const AUTH_WALL_RE = /\b(sign in|sign up|log in|login|create account|password)\b/i;

type JobState = { urls?: string[]; scrapeIdx?: number; inspectIdx?: number; ok?: number };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function pAll<T, R>(items: T[], fn: (t: T) => Promise<R>): Promise<R[]> {
  return Promise.all(items.map(fn));
}

/** Advance one run. Returns true when the run still has work left. */
export async function advanceRun(runId: string): Promise<boolean> {
  const db = await admin();
  const now = new Date();
  // Lease: only one tick works on a run at a time.
  const { data: leased } = await db
    .from("qa_runs")
    .update({ lease_until: new Date(now.getTime() + LEASE_MS).toISOString() })
    .eq("id", runId)
    .not("status", "in", "(completed,failed)")
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("id,user_id,target_url,depth,personas,status,job_state,warnings,usage_event_id")
    .maybeSingle();
  if (!leased) return false;

  const run = leased;
  const userId = run.user_id as string;
  const state = (run.job_state ?? {}) as JobState;
  const warnings: string[] = Array.isArray(run.warnings) ? [...(run.warnings as string[])] : [];
  const personas = run.personas as PersonaId[];
  const started = Date.now();
  const budgetLeft = () => TICK_BUDGET_MS - (Date.now() - started);

  const save = async (patch: Record<string, unknown>) => {
    await db
      .from("qa_runs")
      .update({ ...patch, job_state: state, warnings, updated_at: new Date().toISOString() })
      .eq("id", runId);
  };
  const fail = async (msg: string, refund: boolean) => {
    if (refund && run.usage_event_id) {
      const { refundRun } = await import("@/lib/entitlements.server");
      await refundRun(run.usage_event_id as string);
    }
    await save({
      status: "failed",
      error: refund ? `${msg} — this run was not counted against your plan.` : msg,
      progress_stage: "Failed",
      completed_at: new Date().toISOString(),
      lease_until: null,
    });
    return false;
  };

  try {
    // 1. Map
    if (!state.urls) {
      await save({ status: "mapping", progress_pct: 5, progress_stage: "Discovering URLs" });
      const limit = DEPTH_LIMITS[run.depth as Depth];
      const mapped = await mapSite({ url: run.target_url as string, limit });
      if (!mapped.ok) return await fail(`Could not start: ${mapped.error}`, true);
      let urls = mapped.links.length ? mapped.links : [run.target_url as string];
      if (!urls.includes(run.target_url as string)) urls = [run.target_url as string, ...urls];
      state.urls = urls.slice(0, limit);
      state.scrapeIdx = 0;
      state.inspectIdx = 0;
      state.ok = 0;
      await save({
        status: "scraping",
        progress_pct: 15,
        progress_stage: `Found ${state.urls.length} pages`,
        pages_discovered: state.urls.length,
      });
    }
    const urls = state.urls;

    // 2. Scrape in batches
    while ((state.scrapeIdx ?? 0) < urls.length && budgetLeft() > 8000) {
      const batch = urls.slice(state.scrapeIdx, (state.scrapeIdx ?? 0) + SCRAPE_BATCH);
      const results = await pAll(batch, (u) => scrapePage({ url: u, withScreenshot: true }));
      const rows = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r.ok) {
          warnings.push(`scrape ${batch[i]}: ${r.error}`);
          continue;
        }
        rows.push({
          run_id: runId,
          user_id: userId,
          url: r.page.url,
          title: r.page.title ?? null,
          status: r.page.status ?? null,
          links: r.page.links,
          markdown_preview: r.page.markdownPreview ?? null,
          screenshot_url: r.page.screenshotUrl ?? null,
          latency_ms: r.page.latencyMs ?? null,
          truncated: r.page.truncated ?? false,
        });
      }
      if (rows.length) {
        const { error } = await db.from("qa_pages").insert(rows);
        if (error) warnings.push(`save pages failed: ${error.message}`);
      }
      state.scrapeIdx = (state.scrapeIdx ?? 0) + batch.length;
      await save({
        progress_pct: 15 + Math.round((state.scrapeIdx / urls.length) * 35),
        progress_stage: `Scraping ${state.scrapeIdx}/${urls.length}`,
      });
    }
    if ((state.scrapeIdx ?? 0) < urls.length) {
      await save({ lease_until: null });
      return true;
    }

    const { data: pages } = await db
      .from("qa_pages")
      .select("url,title,links,markdown_preview,screenshot_url,latency_ms,truncated")
      .eq("run_id", runId)
      .order("created_at");
    const pageList = pages ?? [];
    if (pageList.length === 0) return await fail("Could not start: no pages could be scraped", true);

    // 3. Inspect page × persona in batches
    const jobs = pageList.flatMap((p) => personas.map((personaId) => ({ p, personaId })));
    while ((state.inspectIdx ?? 0) < jobs.length && budgetLeft() > 12000) {
      const batch = jobs.slice(state.inspectIdx, (state.inspectIdx ?? 0) + INSPECT_BATCH);
      const results = await pAll(batch, ({ p, personaId }) =>
        inspectPage({
          personaId,
          page: {
            url: p.url,
            title: p.title ?? undefined,
            links: (p.links as string[]) ?? [],
            markdownPreview: p.markdown_preview ?? "",
            screenshotUrl: p.screenshot_url,
            latencyMs: p.latency_ms,
            truncated: p.truncated,
          },
        }).catch((err: unknown) => ({ ok: false as const, error: String(err), summary: "", findings: [] })),
      );
      const rows = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const { p, personaId } = batch[i];
        if (!r.ok) {
          warnings.push(`inspect ${personaId} ${p.url}: ${r.error}`);
          continue;
        }
        state.ok = (state.ok ?? 0) + 1;
        for (const f of r.findings) {
          rows.push({
            run_id: runId,
            user_id: userId,
            persona_id: personaId,
            page_url: p.url,
            category: f.category,
            severity: f.severity,
            confidence: f.confidence,
            title: f.title,
            detail: f.detail,
            suggestion: f.suggestion ?? null,
            basis: f.basis ?? "inferred",
          });
        }
      }
      if (rows.length) {
        const { error } = await db.from("qa_findings").insert(rows);
        if (error) warnings.push(`save findings failed: ${error.message}`);
      }
      state.inspectIdx = (state.inspectIdx ?? 0) + batch.length;
      const last = batch[batch.length - 1];
      await save({
        status: "inspecting",
        progress_pct: 55 + Math.round((state.inspectIdx / jobs.length) * 40),
        progress_stage: `Inspecting ${PERSONAS[last.personaId]?.name ?? last.personaId} (${state.inspectIdx}/${jobs.length})`,
      });
    }
    if ((state.inspectIdx ?? 0) < jobs.length) {
      await save({ lease_until: null });
      return true;
    }
    if ((state.ok ?? 0) === 0) return await fail("All inspections failed", false);

    // 4. Finalize: measured perf findings + score
    const perf = pageList
      .filter((p) => (p.latency_ms ?? 0) >= SLOW_MS)
      .map((p) => ({
        run_id: runId,
        user_id: userId,
        persona_id: "measurement",
        page_url: p.url,
        category: "performance",
        severity: (p.latency_ms ?? 0) >= VERY_SLOW_MS ? "high" : "medium",
        confidence: 1,
        title: `Page fetch took ${((p.latency_ms ?? 0) / 1000).toFixed(1)}s`,
        detail: `Page fetch time through the crawler (includes rendering and screenshot) for ${p.url} was ${p.latency_ms}ms, above the ${SLOW_MS}ms threshold.`,
        suggestion: "Check server response time, payload size and any blocking upstream calls for this route.",
        basis: "observed",
      }));
    if (perf.length) await db.from("qa_findings").insert(perf);

    const authWalled = pageList.every(
      (p) => (p.markdown_preview ?? "").length < 900 && AUTH_WALL_RE.test(p.markdown_preview ?? ""),
    );
    if (authWalled) {
      warnings.push(
        "Every page reached looks like a sign-in wall — the crawler never saw the app behind auth, so this score covers the public shell only.",
      );
    }
    const { data: all } = await db.from("qa_findings").select("*").eq("run_id", runId);
    const score = computeScore(
      (all ?? []).map((f) => ({
        id: f.id,
        runId,
        personaId: f.persona_id as PersonaId,
        pageUrl: f.page_url,
        category: f.category as never,
        severity: f.severity as never,
        confidence: Number(f.confidence),
        title: f.title,
        detail: f.detail,
        suggestion: f.suggestion ?? undefined,
        basis: f.basis as never,
      })),
      pageList.length,
      Math.max(urls.length, 1),
      personas.length,
    );
    await save({
      status: "completed",
      progress_pct: 100,
      progress_stage: "Complete",
      score: score.score,
      verdict: authWalled && score.verdict === "ready" ? "minor" : score.verdict,
      pages_scraped: pageList.length,
      pages_discovered: urls.length,
      completed_at: new Date().toISOString(),
      lease_until: null,
    });
    return false;
  } catch (err) {
    warnings.push(`tick error: ${err instanceof Error ? err.message : String(err)}`);
    await save({ lease_until: null });
    return true;
  }
}

/** Ask the database to call the tick route again (fire-and-forget via pg_net). */
export async function wakeRun(runId: string) {
  const db = await admin();
  const { error } = await db.rpc("qa_wake", { p_run_id: runId });
  if (error) console.error("qa_wake failed", error.message);
}

/** Public stable URL the database can reach for this deployment. */
export function wakeUrlFor(requestUrl: string): string | null {
  try {
    const u = new URL(requestUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return null;
    // Editor preview hosts sit behind the Lovable login; use the stable dev URL.
    if (u.hostname.startsWith("id-preview--")) {
      return "https://project--8cd826d6-1ff3-4890-a348-08f1081f3ec2-dev.lovable.app";
    }
    return u.origin;
  } catch {
    return null;
  }
}
