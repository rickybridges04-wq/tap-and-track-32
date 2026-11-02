import { describe, expect, it } from "vitest";
import { canStartRun, PlanError } from "@/lib/entitlements.server";
import { FREE_RUN_LIMIT, PRO_PRICE_KEY, isPlanError } from "@/lib/plan";

const base = { isOwner: false, isSubscribed: false, runsUsed: 0 };

describe("run limits", () => {
  it("free plan is 3 runs total", () => expect(FREE_RUN_LIMIT).toBe(3));
  it("free user with 2 runs used can start a 3rd", () =>
    expect(canStartRun({ ...base, runsUsed: 2 })).toBe(true));
  it("free user with 3 runs used is blocked", () =>
    expect(canStartRun({ ...base, runsUsed: 3 })).toBe(false));
  it("Pro subscriber is unlimited", () =>
    expect(canStartRun({ ...base, isSubscribed: true, runsUsed: 500 })).toBe(true));
  it("owner role bypasses the limit", () =>
    expect(canStartRun({ ...base, isOwner: true, runsUsed: 500 })).toBe(true));
  it("limit refusal is a PLAN error", () => expect(isPlanError(new PlanError())).toBe(true));
  it("Pro price key is wizard_pro_monthly", () => expect(PRO_PRICE_KEY).toBe("wizard_pro_monthly"));
});
