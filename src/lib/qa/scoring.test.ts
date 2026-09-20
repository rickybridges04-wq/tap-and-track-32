import { describe, it, expect } from "vitest";
import { computeScore, verdictLabel, type QaFinding } from "./scoring";

function finding(over: Partial<QaFinding>): QaFinding {
  return {
    id: crypto.randomUUID(),
    runId: "r",
    personaId: "p",
    pageUrl: "https://example.com",
    category: "functional",
    severity: "medium",
    confidence: 1,
    title: "t",
    detail: "d",
    basis: "observed",
    ...over,
  };
}

describe("computeScore", () => {
  it("returns a perfect score with no findings and full coverage", () => {
    const r = computeScore([], 10, 10, 1);
    expect(r.score).toBe(100);
    expect(r.verdict).toBe("ready");
    expect(r.counts).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
  });

  it("weights severities: critical costs more than high, high more than low", () => {
    const base = (s: QaFinding["severity"]) =>
      computeScore([finding({ severity: s })], 10, 10, 1).score;
    expect(base("critical")).toBeLessThan(base("high"));
    expect(base("high")).toBeLessThan(base("medium"));
    expect(base("medium")).toBeLessThan(base("low"));
    expect(base("low")).toBeLessThan(100);
  });

  it("excludes inferred visual and performance findings from the score", () => {
    const inferred = [
      finding({ category: "visual", basis: "inferred", severity: "critical" }),
      finding({ category: "performance", basis: "inferred", severity: "critical" }),
    ];
    const r = computeScore(inferred, 10, 10, 1);
    expect(r.score).toBe(100);
    expect(r.excludedInferred).toBe(2);
    expect(r.counts.critical).toBe(0);
  });

  it("still scores inferred functional and accessibility findings", () => {
    const r = computeScore(
      [finding({ category: "accessibility", basis: "inferred", severity: "high" })],
      10,
      10,
      1,
    );
    expect(r.excludedInferred).toBe(0);
    expect(r.score).toBeLessThan(100);
  });

  it("normalizes penalties by pages x personas so deeper runs are not punished", () => {
    const many = Array.from({ length: 8 }, () => finding({ severity: "medium" }));
    const shallow = computeScore(many.slice(0, 2), 2, 2, 1).score;
    const deep = computeScore(many, 8, 8, 1).score;
    expect(deep).toBe(shallow);
  });

  it("caps the verdict at 'minor' when coverage is thin", () => {
    const r = computeScore([], 2, 20, 1);
    expect(r.lowCoverage).toBe(true);
    expect(r.verdict).toBe("minor");
    expect(r.score).toBeLessThan(100);
  });

  it("blocks the release on any critical finding", () => {
    const r = computeScore([finding({ severity: "critical" })], 10, 10, 1);
    expect(r.verdict).toBe("block");
    expect(verdictLabel(r.verdict)).toBe("Block Release");
  });

  it("keeps the score inside 0..100 under heavy penalties", () => {
    const lots = Array.from({ length: 50 }, () => finding({ severity: "critical" }));
    const r = computeScore(lots, 1, 1, 1);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
