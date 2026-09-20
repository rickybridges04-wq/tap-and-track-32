import { describe, it, expect } from "vitest";
import { StepSchema, StepsSchema, STEP_ACTIONS, STEP_FIELDS, STEP_LABELS } from "./steps";

describe("Step schema", () => {
  it("accepts a minimal valid step", () => {
    expect(StepSchema.parse({ action: "goto", value: "/" })).toEqual({
      action: "goto",
      value: "/",
    });
  });

  it("rejects an unknown action", () => {
    expect(StepSchema.safeParse({ action: "hover" }).success).toBe(false);
  });

  it("rejects a timeout outside 100..60000 and a non-integer timeout", () => {
    expect(StepSchema.safeParse({ action: "click", timeout_ms: 50 }).success).toBe(false);
    expect(StepSchema.safeParse({ action: "click", timeout_ms: 60001 }).success).toBe(false);
    expect(StepSchema.safeParse({ action: "click", timeout_ms: 1000.5 }).success).toBe(false);
    expect(StepSchema.safeParse({ action: "click", timeout_ms: 10000 }).success).toBe(true);
  });

  it("rejects over-long selectors and values", () => {
    expect(StepSchema.safeParse({ action: "click", selector: "a".repeat(501) }).success).toBe(false);
    expect(StepSchema.safeParse({ action: "fill", value: "a".repeat(2001) }).success).toBe(false);
  });

  it("caps a case at 200 steps", () => {
    const ok = Array.from({ length: 200 }, () => ({ action: "click" as const, selector: "a" }));
    expect(StepsSchema.safeParse(ok).success).toBe(true);
    expect(StepsSchema.safeParse([...ok, { action: "click", selector: "a" }]).success).toBe(false);
  });

  it("has a label and field hints for every action", () => {
    for (const action of STEP_ACTIONS) {
      expect(STEP_LABELS[action]).toBeTruthy();
      expect(STEP_FIELDS[action]).toBeDefined();
    }
  });
});
