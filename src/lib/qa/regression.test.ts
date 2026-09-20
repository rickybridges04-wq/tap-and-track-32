import { describe, it, expect } from "vitest";
import { diffState, isFlaky, buildDiff, median, type CaseVerdict } from "./regression";

describe("diffState", () => {
  it("labels each transition", () => {
    expect(diffState("fail", "pass")).toBe("newly_failing");
    expect(diffState("pass", "fail")).toBe("fixed");
    expect(diffState("fail", "fail")).toBe("still_failing");
    expect(diffState("pass", "pass")).toBe("still_passing");
    expect(diffState("pass", null)).toBe("new_case");
  });

  it("counts an infrastructure error as a failure", () => {
    expect(diffState("error", "pass")).toBe("newly_failing");
    expect(diffState("pass", "error")).toBe("fixed");
  });
});

describe("isFlaky", () => {
  it("needs two or more flips", () => {
    const h = (s: string): CaseVerdict[] => s.split("").map((c) => (c === "p" ? "pass" : "fail"));
    expect(isFlaky(h("pppp"))).toBe(false);
    expect(isFlaky(h("ppff"))).toBe(false); // one flip = a real regression
    expect(isFlaky(h("pfpf"))).toBe(true);
    expect(isFlaky([])).toBe(false);
  });
});

describe("buildDiff", () => {
  const cases = [
    { id: "1", code: "B-002", title: "b" },
    { id: "2", code: "A-001", title: "a" },
  ];

  it("sorts newly failing first and marks flaky cases", () => {
    const rows = buildDiff({
      cases,
      current: { "1": "pass", "2": "fail" },
      previous: { "1": "pass", "2": "pass" },
      history: { "2": ["pass", "fail", "pass", "fail"] },
    });
    expect(rows[0].code).toBe("A-001");
    expect(rows[0].state).toBe("newly_failing");
    expect(rows[0].flaky).toBe(true);
    expect(rows[1].state).toBe("still_passing");
  });

  it("marks every case new when there is no previous run", () => {
    const rows = buildDiff({ cases, current: { "1": "pass" }, previous: null, history: {} });
    expect(rows.every((r) => r.state === "new_case")).toBe(true);
  });
});

describe("median", () => {
  it("handles odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([])).toBeNull();
    expect(median([Number.NaN])).toBeNull();
  });
});
