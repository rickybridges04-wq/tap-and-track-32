/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-only: automated run report — data, regression diff, CSV, PDF and a
// number-checked AI executive summary.
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildDiff, isFlaky, median, type CaseVerdict, type DiffRow } from "@/lib/qa/regression";

const MODEL = "google/gemini-3.8-flash";

type Db = { from: (table: string) => any };

export type AxeImpact = "critical" | "serious" | "moderate" | "minor" | "unknown";

export type Report = {
  run: {
    id: string;
    short_id: string;
    kind: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    target_url: string;
    score: number | null;
    verdict: string | null;
    total: number;
    passed: number;
    failed: number;
    errored: number;
    pass_rate_pct: number;
  };
  project: { id: string; name: string; base_url: string; environment: string } | null;
  critical_failures: Array<{ code: string; title: string; step: number | null; error: string }>;
  diff: DiffRow[];
  previous_run_id: string | null;
  failure_groups: Array<{
    signature: string;
    failures: number;
    cases: string[];
    error_message: string | null;
    likely_cause: string | null;
    repro_steps: string[];
    suggested_severity: string | null;
    confidence: number | null;
    occurrences: number | null;
  }>;
  performance: {
    median_lcp_ms: number | null;
    median_ttfb_ms: number | null;
    median_fcp_ms: number | null;
    slowest: Array<{ code: string; title: string; duration_ms: number }>;
  };
  accessibility: {
    total_violations: number;
    by_impact: Record<AxeImpact, number>;
    top: Array<{ id: string; help: string; nodes: number; impact: AxeImpact }>;
  };
  summary: string | null;
  summary_warning: string | null;
};

function impactOf(v: any): AxeImpact {
  const i = String(v?.impact ?? "").toLowerCase();
  return i === "critical" || i === "serious" || i === "moderate" || i === "minor"
    ? (i as AxeImpact)
    : "unknown";
}

/** Regression diff for one automated run against the previous completed one. */
export async function computeRegression(
  db: Db,
  run: { id: string; project_id: string | null; created_at: string; user_id: string },
): Promise<{ diff: DiffRow[]; previous_run_id: string | null }> {
  const casesOfRun = async (runId: string) => {
    const { data } = await db
      .from("automated_results")
      .select("case_id, status")
      .eq("run_id", runId);
    const map: Record<string, CaseVerdict> = {};
    for (const r of data ?? []) map[r.case_id] = r.status as CaseVerdict;
    return map;
  };

  const current = await casesOfRun(run.id);

  if (!run.project_id) {
    const cases = await caseMeta(db, Object.keys(current));
    return { diff: buildDiff({ cases, current, previous: null, history: {} }), previous_run_id: null };
  }

  const { data: history } = await db
    .from("qa_runs")
    .select("id, created_at")
    .eq("project_id", run.project_id)
    .eq("kind", "automated")
    .eq("status", "completed")
    .lte("created_at", run.created_at)
    .order("created_at", { ascending: false })
    .limit(6);

  const previousRuns = (history ?? []).filter((r: any) => r.id !== run.id);
  const previousId: string | null = previousRuns[0]?.id ?? null;
  const previous = previousId ? await casesOfRun(previousId) : null;

  // Flakiness over the last 5 runs, oldest → newest (current run included).
  const lastFive = [run.id, ...previousRuns.slice(0, 4).map((r: any) => r.id)].reverse();
  const perCase: Record<string, CaseVerdict[]> = {};
  for (const rid of lastFive) {
    const map = rid === run.id ? current : await casesOfRun(rid);
    for (const [caseId, status] of Object.entries(map)) {
      (perCase[caseId] ??= []).push(status);
    }
  }

  const ids = new Set([...Object.keys(current), ...Object.keys(previous ?? {})]);
  const cases = await caseMeta(db, Array.from(ids));
  return {
    diff: buildDiff({ cases, current, previous, history: perCase }),
    previous_run_id: previousId,
  };
}

async function caseMeta(db: Db, ids: string[]) {
  if (ids.length === 0) return [] as Array<{ id: string; code: string; title: string }>;
  const { data } = await db.from("test_cases").select("id, code, title").in("id", ids);
  return (data ?? []) as Array<{ id: string; code: string; title: string }>;
}

export async function buildReport(
  db: Db,
  runId: string,
  opts: { withSummary?: boolean } = {},
): Promise<Report | null> {
  const { data: run } = await db.from("qa_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return null;

  const [{ data: results }, { data: project }] = await Promise.all([
    db.from("automated_results").select("*").eq("run_id", runId),
    run.project_id
      ? db
          .from("qa_projects")
          .select("id, name, base_url, environment")
          .eq("id", run.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rows = (results ?? []) as any[];
  const cases = await caseMeta(db, rows.map((r) => r.case_id));
  const caseById = new Map(cases.map((c) => [c.id, c]));

  const passed = rows.filter((r) => r.status === "pass").length;
  const errored = rows.filter((r) => r.status === "error").length;
  const failed = rows.length - passed;
  const total = rows.length;

  const criticalFailures = rows
    .filter((r) => r.status !== "pass")
    .map((r) => ({
      code: caseById.get(r.case_id)?.code ?? "—",
      title: caseById.get(r.case_id)?.title ?? "",
      step: r.failed_step_index ?? null,
      error: r.error_message ?? "No error message reported.",
    }));

  // Failure groups + stored AI suggestions.
  const signatures = Array.from(
    new Set(rows.filter((r) => r.status === "fail" && r.error_signature).map((r) => r.error_signature)),
  ) as string[];
  const { data: analyses } = signatures.length
    ? await db
        .from("failure_analyses")
        .select(
          "error_signature, likely_cause, repro_steps, suggested_severity, confidence, occurrences",
        )
        .eq("user_id", run.user_id)
        .in("error_signature", signatures)
    : { data: [] as any[] };
  const analysisBySig = new Map<string, any>(
    (analyses ?? []).map((a: any) => [a.error_signature as string, a]),
  );

  const failureGroups = signatures.map((sig) => {
    const group = rows.filter((r) => r.error_signature === sig);
    const a = analysisBySig.get(sig);
    return {
      signature: sig,
      failures: group.length,
      cases: group.map((r) => caseById.get(r.case_id)?.code ?? "—"),
      error_message: group[0]?.error_message ?? null,
      likely_cause: a?.likely_cause ?? null,
      repro_steps: Array.isArray(a?.repro_steps) ? (a.repro_steps as string[]) : [],
      suggested_severity: a?.suggested_severity ?? null,
      confidence: a?.confidence ?? null,
      occurrences: a?.occurrences ?? null,
    };
  });

  // Performance
  const vital = (r: any, k: string) => Number(r.web_vitals?.[k]);
  const performance = {
    median_lcp_ms: median(rows.map((r) => vital(r, "lcp_ms"))),
    median_ttfb_ms: median(rows.map((r) => vital(r, "ttfb_ms"))),
    median_fcp_ms: median(rows.map((r) => vital(r, "fcp_ms"))),
    slowest: rows
      .filter((r) => Number.isFinite(Number(r.duration_ms)))
      .sort((a, b) => Number(b.duration_ms) - Number(a.duration_ms))
      .slice(0, 10)
      .map((r) => ({
        code: caseById.get(r.case_id)?.code ?? "—",
        title: caseById.get(r.case_id)?.title ?? "",
        duration_ms: Number(r.duration_ms),
      })),
  };

  // Accessibility
  const byImpact: Record<AxeImpact, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    unknown: 0,
  };
  const top = new Map<string, { id: string; help: string; nodes: number; impact: AxeImpact }>();
  let totalViolations = 0;
  for (const r of rows) {
    const list = Array.isArray(r.axe_violations) ? r.axe_violations : [];
    for (const v of list) {
      const imp = impactOf(v);
      byImpact[imp]++;
      totalViolations++;
      const prev = top.get(v.id);
      top.set(v.id, {
        id: v.id,
        help: v.help ?? "",
        nodes: (prev?.nodes ?? 0) + (Number(v.nodes) || 0),
        impact: imp,
      });
    }
  }

  const { diff, previous_run_id } = await computeRegression(db, run);

  const report: Report = {
    run: {
      id: run.id,
      short_id: String(run.id).slice(0, 8),
      kind: run.kind,
      status: run.status,
      created_at: run.created_at,
      completed_at: run.completed_at,
      target_url: run.target_url,
      score: run.score,
      verdict: run.verdict,
      total,
      passed,
      failed,
      errored,
      pass_rate_pct: total ? Math.round((passed / total) * 100) : 0,
    },
    project: (project as any) ?? null,
    critical_failures: criticalFailures,
    diff,
    previous_run_id,
    failure_groups: failureGroups,
    performance,
    accessibility: {
      total_violations: totalViolations,
      by_impact: byImpact,
      top: Array.from(top.values())
        .sort((a, b) => b.nodes - a.nodes)
        .slice(0, 10),
    },
    summary: null,
    summary_warning: null,
  };

  if (opts.withSummary) {
    const { summary, warning } = await executiveSummary(report);
    report.summary = summary;
    report.summary_warning = warning;
  }
  return report;
}

// ---------------- AI executive summary (numbers must come from the data) ----

function allowedNumbers(r: Report): Set<string> {
  const nums: Array<number | null> = [
    r.run.total,
    r.run.passed,
    r.run.failed,
    r.run.errored,
    r.run.pass_rate_pct,
    r.run.score,
    r.accessibility.total_violations,
    r.accessibility.by_impact.critical,
    r.accessibility.by_impact.serious,
    r.accessibility.by_impact.moderate,
    r.accessibility.by_impact.minor,
    r.performance.median_lcp_ms,
    r.performance.median_ttfb_ms,
    r.performance.median_fcp_ms,
    r.diff.filter((d) => d.state === "newly_failing").length,
    r.diff.filter((d) => d.state === "fixed").length,
    r.diff.filter((d) => d.state === "still_failing").length,
    r.diff.filter((d) => d.flaky).length,
    r.failure_groups.length,
    0,
  ];
  const set = new Set<string>();
  for (const n of nums) {
    if (n == null || !Number.isFinite(n)) continue;
    set.add(String(n));
    set.add(String(Math.round(n)));
    if (n >= 1000) set.add((n / 1000).toFixed(1)); // seconds form of a millisecond figure
  }
  return set;
}

export function checkSummaryNumbers(text: string, r: Report): string | null {
  const found = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const allowed = allowedNumbers(r);
  for (const raw of found) {
    const n = raw.replace(",", ".");
    if (!allowed.has(n) && !allowed.has(String(Number(n)))) return n;
  }
  return null;
}

export async function executiveSummary(
  r: Report,
): Promise<{ summary: string | null; warning: string | null }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { summary: null, warning: "No AI key configured, summary skipped." };

  const facts = {
    total_cases: r.run.total,
    passed: r.run.passed,
    failed: r.run.failed,
    errored: r.run.errored,
    pass_rate_pct: r.run.pass_rate_pct,
    readiness_score: r.run.score,
    verdict: r.run.verdict,
    newly_failing: r.diff.filter((d) => d.state === "newly_failing").length,
    fixed: r.diff.filter((d) => d.state === "fixed").length,
    still_failing: r.diff.filter((d) => d.state === "still_failing").length,
    flaky: r.diff.filter((d) => d.flaky).length,
    root_causes: r.failure_groups.length,
    accessibility_violations: r.accessibility.total_violations,
    median_lcp_ms: r.performance.median_lcp_ms,
    median_ttfb_ms: r.performance.median_ttfb_ms,
  };

  const gateway = createLovableAiGatewayProvider(key);
  try {
    const { text } = await generateText({
      model: gateway(MODEL),
      system:
        "You write a 3-sentence executive summary of an automated test run. " +
        "You may ONLY restate the numbers given to you. Never invent, estimate, " +
        "derive or round any number that is not in the data. No recommendations, " +
        "no causes, no speculation. Plain sentences, no markdown.",
      prompt: JSON.stringify(facts),
    });
    const summary = text.trim();
    const bad = checkSummaryNumbers(summary, r);
    if (bad) {
      return {
        summary: null,
        warning: `Summary rejected: it used the number ${bad}, which is not in the run data.`,
      };
    }
    return { summary, warning: null };
  } catch (e) {
    return {
      summary: null,
      warning: `Summary unavailable: ${e instanceof Error ? e.message : "AI request failed"}`,
    };
  }
}

// ---------------- exports ----------------

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportCsv(r: Report): string {
  const lines: string[] = [];
  const row = (...cells: unknown[]) => lines.push(cells.map(csvCell).join(","));
  row("section", "a", "b", "c", "d");
  row("run", r.run.id, r.run.target_url, r.run.status, r.run.created_at);
  row("score", r.run.score ?? "", r.run.verdict ?? "", "", "");
  row("counts", `total ${r.run.total}`, `pass ${r.run.passed}`, `fail ${r.run.failed}`, `pass_rate ${r.run.pass_rate_pct}%`);
  for (const d of r.diff) row("regression", d.code, d.state, d.flaky ? "flaky" : "", d.title);
  for (const f of r.critical_failures) row("failure", f.code, `step ${f.step ?? ""}`, f.error, f.title);
  for (const g of r.failure_groups)
    row("failure_group", g.cases.join(" "), `${g.failures} failure(s)`, g.likely_cause ?? "", g.suggested_severity ?? "");
  row(
    "performance",
    `median_lcp_ms ${r.performance.median_lcp_ms ?? ""}`,
    `median_ttfb_ms ${r.performance.median_ttfb_ms ?? ""}`,
    `median_fcp_ms ${r.performance.median_fcp_ms ?? ""}`,
    "",
  );
  for (const s of r.performance.slowest) row("slowest_case", s.code, s.duration_ms, s.title, "");
  row(
    "accessibility",
    `total ${r.accessibility.total_violations}`,
    `critical ${r.accessibility.by_impact.critical}`,
    `serious ${r.accessibility.by_impact.serious}`,
    `moderate ${r.accessibility.by_impact.moderate}`,
  );
  for (const a of r.accessibility.top) row("axe", a.id, a.impact, a.nodes, a.help);
  if (r.summary) row("summary", r.summary, "", "", "");
  return lines.join("\n");
}

export async function reportPdf(r: Report): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595, 842]);
  let y = 800;
  const write = (text: string, size = 10, useBold = false) => {
    const max = 92;
    const chunks = text.length > max ? (text.match(new RegExp(`.{1,${max}}`, "g")) ?? [text]) : [text];
    for (const chunk of chunks) {
      if (y < 50) {
        page = doc.addPage([595, 842]);
        y = 800;
      }
      page.drawText(chunk.replace(/[^\x20-\x7E]/g, " "), {
        x: 40,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.1, 0.1, 0.12),
      });
      y -= size + 4;
    }
  };
  const gap = () => (y -= 8);

  write(`Automated test report - RUN #${r.run.short_id}`, 16, true);
  write(`${r.project?.name ?? "Unattached project"} - ${r.run.target_url}`, 10);
  write(`Started ${r.run.created_at}${r.run.completed_at ? ` - completed ${r.run.completed_at}` : ""}`);
  gap();
  write("Result", 12, true);
  write(`Pass rate: ${r.run.pass_rate_pct}% (${r.run.passed} pass / ${r.run.failed} fail of ${r.run.total})`);
  write(`Readiness score: ${r.run.score ?? "-"} (${r.run.verdict ?? "-"})`);
  if (r.summary) {
    gap();
    write("Executive summary", 12, true);
    write(r.summary);
  }
  gap();
  write("Regression diff", 12, true);
  if (r.diff.length === 0) write("No cases recorded.");
  for (const d of r.diff) write(`${d.code}: ${d.state}${d.flaky ? " (flaky)" : ""} - ${d.title}`);
  gap();
  write("Critical failures", 12, true);
  if (r.critical_failures.length === 0) write("None.");
  for (const f of r.critical_failures)
    write(`${f.code} step ${f.step ?? "-"}: ${f.error}`);
  gap();
  write("Failure groups (AI text is a suggestion)", 12, true);
  if (r.failure_groups.length === 0) write("None.");
  for (const g of r.failure_groups) {
    write(`${g.failures} failure(s) - cases ${g.cases.join(", ")}`, 10, true);
    write(`Error: ${g.error_message ?? "-"}`);
    write(`Suggestion - AI: ${g.likely_cause ?? "none stored"}`);
  }
  gap();
  write("Performance", 12, true);
  write(
    `Median LCP ${r.performance.median_lcp_ms ?? "-"} ms - median TTFB ${r.performance.median_ttfb_ms ?? "-"} ms`,
  );
  for (const s of r.performance.slowest.slice(0, 5)) write(`Slowest: ${s.code} ${s.duration_ms} ms`);
  gap();
  write("Accessibility", 12, true);
  write(
    `${r.accessibility.total_violations} violation(s) - critical ${r.accessibility.by_impact.critical}, serious ${r.accessibility.by_impact.serious}, moderate ${r.accessibility.by_impact.moderate}, minor ${r.accessibility.by_impact.minor}`,
  );
  for (const a of r.accessibility.top.slice(0, 8)) write(`${a.id} (${a.impact}) x${a.nodes}: ${a.help}`);

  return await doc.save();
}

export { isFlaky };
