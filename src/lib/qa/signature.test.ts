import { describe, it, expect } from "vitest";
import { normalizeErrorMessage, errorSignature } from "./signature";

describe("normalizeErrorMessage", () => {
  it("masks numbers, uuids and hex, and collapses whitespace", () => {
    expect(
      normalizeErrorMessage(
        "Timeout 30000ms exceeded for 3f1b2c4d-1111-2222-3333-444455556666 at 0xDEADBEEF",
      ),
    ).toBe("timeout <n>ms exceeded for <uuid> at <hex>");
    expect(normalizeErrorMessage("  A   B  ")).toBe("a b");
  });

  it("treats null and empty input as an empty string", () => {
    expect(normalizeErrorMessage(null)).toBe("");
    expect(normalizeErrorMessage(undefined)).toBe("");
  });
});

describe("errorSignature", () => {
  it("returns null for passing results", async () => {
    expect(await errorSignature("pass", "anything", "button")).toBeNull();
  });

  it("gives the same signature to the same failure with different ids and timings", async () => {
    const a = await errorSignature("fail", "Timeout 30000ms waiting for #cart", "#cart");
    const b = await errorSignature("fail", "Timeout 45000ms waiting for #cart", "#cart");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("separates different selectors and different messages", async () => {
    const a = await errorSignature("fail", "Timeout waiting for element", "#cart");
    const b = await errorSignature("fail", "Timeout waiting for element", "#checkout");
    const c = await errorSignature("fail", "Element is not visible", "#cart");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("signs infrastructure errors too", async () => {
    expect(await errorSignature("error", "worker lost", null)).toMatch(/^[0-9a-f]{64}$/);
  });
});
