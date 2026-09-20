import { describe, it, expect } from "vitest";
import { checkSummaryNumbers, type Report } from "./report.server";

const report: Report = {
  run: {
    id: "run-1",
    short_id: "run-1",
    kind: "automated",
    status: "completed",
    created_at: new Date().toISOString(),
    completed_at: null,
    target_url: "https://example.com",
    score: 66,
    verdict: "major",
    total: 2,
    passed: 1,
    failed: 1,
    errored: 0,
    pass_rate_pct: 50,
  },
  project: null,
  critical_failures: [],
  diff: [],
  previous_run_id: null,
  failure_groups: [],
  performance: {
    median_lcp_ms: 2800,
    median_ttfb_ms: 460,
    median_fcp_ms: null,
    slowest: [],
  },
  accessibility: {
    total_violations: 1,
    by_impact: { critical: 0, serious: 1, moderate: 0, minor: 0, unknown: 0 },
    top: [],
  },
  summary: null,
  summary_warning: null,
};

describe("executive summary number guard", () => {
  it("accepts a summary that only restates figures from the run", () => {
    expect(
      checkSummaryNumbers(
        "2 cases ran, 1 passed and 1 failed, a 50% pass rate with a readiness score of 66.",
        report,
      ),
    ).toBeNull();
  });

  it("accepts prose with no numbers at all", () => {
    expect(checkSummaryNumbers("The run finished with failures still outstanding.", report)).toBeNull();
  });

  it("rejects an invented number and names it", () => {
    expect(checkSummaryNumbers("The run took 87 seconds.", report)).toBe("87");
  });

  it("accepts millisecond figures in their seconds form", () => {
    expect(checkSummaryNumbers("Largest contentful paint sits at 2.8 seconds.", report)).toBeNull();
  });

  it("rejects a plausible-but-wrong pass rate", () => {
    expect(checkSummaryNumbers("A 75% pass rate was recorded.", report)).toBe("75");
  });
});
