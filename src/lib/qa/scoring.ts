// Production Readiness Score for Synapse QA OS.
export type Severity = "critical" | "high" | "medium" | "low";
export type Category = "functional" | "visual" | "accessibility" | "performance";
export type QaFinding = {
  id: string;
  runId: string;
  personaId: string;
  pageUrl: string;
  category: Category;
  severity: Severity;
  confidence: number;
  title: string;
  detail: string;
  suggestion?: string;
};

const WEIGHT: Record<Severity, number> = {
  critical: 15,
  high: 7,
  medium: 3,
  low: 1,
};

export type ScoreResult = {
  score: number;
  verdict: "ready" | "minor" | "major" | "block";
  subscores: { functional: number; visual: number; accessibility: number; coverage: number };
  counts: Record<Severity, number>;
};

// Tuned so ~1 medium-confidence finding per 4 (page × persona) inspections
// costs ~9 points, keeping standard 4-persona runs near their historical scores.
const NORMALIZATION_CONSTANT = 12;

export function computeScore(
  findings: QaFinding[],
  pagesCrawled: number,
  linksDiscovered: number,
  personaCount: number = 1,
): ScoreResult {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  let funcPenalty = 0;
  let visualPenalty = 0;
  let a11yPenalty = 0;

  for (const f of findings) {
    counts[f.severity]++;
    const w = WEIGHT[f.severity] * (f.confidence || 0.7);
    if (f.category === "functional") funcPenalty += w;
    else if (f.category === "visual") visualPenalty += w;
    else if (f.category === "accessibility") a11yPenalty += w;
  }

  const inspectionUnits = Math.max(1, pagesCrawled * Math.max(1, personaCount));
  const norm = (p: number) => (p / inspectionUnits) * NORMALIZATION_CONSTANT;

  const coverage = linksDiscovered > 0 ? Math.min(1, pagesCrawled / Math.max(1, linksDiscovered)) : 1;
  const coverageScore = Math.round(coverage * 100);

  const functional = Math.max(0, Math.round(100 - norm(funcPenalty)));
  const visual = Math.max(0, Math.round(100 - norm(visualPenalty)));
  const accessibility = Math.max(0, Math.round(100 - norm(a11yPenalty)));

  // Coverage acts as a multiplier — half-crawled site cannot score 100.
  const raw = (functional * 0.4 + visual * 0.25 + accessibility * 0.25 + coverageScore * 0.1);
  const score = Math.max(0, Math.min(100, Math.round(raw * (0.5 + 0.5 * coverage))));

  let verdict: ScoreResult["verdict"] = "ready";
  if (counts.critical > 0 || score < 50) verdict = "block";
  else if (counts.high > 2 || score < 70) verdict = "major";
  else if (score < 85) verdict = "minor";

  return {
    score,
    verdict,
    subscores: { functional, visual, accessibility, coverage: coverageScore },
    counts,
  };
}

export function verdictLabel(v: ScoreResult["verdict"]): string {
  return {
    ready: "Ready for Release",
    minor: "Release with Minor Issues",
    major: "Release with Major Risks",
    block: "Block Release",
  }[v];
}

export function verdictColor(v: ScoreResult["verdict"]): string {
  return {
    ready: "text-emerald-600 bg-emerald-500/15",
    minor: "text-amber-600 bg-amber-500/15",
    major: "text-orange-600 bg-orange-500/15",
    block: "text-rose-600 bg-rose-500/15",
  }[v];
}
