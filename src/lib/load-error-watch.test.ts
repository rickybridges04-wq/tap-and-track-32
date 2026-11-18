import { describe, expect, it } from "vitest";
import { isLoadFailure, isServerFnRead, serverFnFailed } from "@/lib/load-error-watch";

describe("isLoadFailure", () => {
  it("flags failed reads, edge functions and server functions", () => {
    expect(isLoadFailure("https://x.supabase.co/rest/v1/quotes?select=*", "GET", 500)).toBe("read");
    expect(isLoadFailure("https://x.supabase.co/rest/v1/quotes", "GET", null)).toBe("read");
    expect(isLoadFailure("https://x.supabase.co/functions/v1/billing", "POST", 502)).toBe("action");
    expect(isLoadFailure("/_serverFn/abc123", "POST", 500)).toBe("action");
    expect(isLoadFailure("/_serverFn/abc123?payload=1", "GET", 500)).toBe("read");
  });
  it("ignores successes, client errors, database writes and auth", () => {
    expect(isLoadFailure("https://x.supabase.co/rest/v1/quotes", "GET", 200)).toBeNull();
    expect(isLoadFailure("https://x.supabase.co/rest/v1/quotes", "GET", 406)).toBeNull();
    expect(isLoadFailure("https://x.supabase.co/rest/v1/quotes", "POST", 500)).toBeNull();
    expect(isLoadFailure("https://x.supabase.co/auth/v1/token", "POST", 500)).toBeNull();
    expect(isLoadFailure("/_serverFn/abc", "POST", 400)).toBeNull();
    expect(isLoadFailure("https://example.com/api", "GET", 500)).toBeNull();
  });
});

describe("server function replies", () => {
  it("spots a serialized thrown error on a read", () => {
    expect(isServerFnRead("/_serverFn/abc", "GET")).toBe(true);
    expect(isServerFnRead("/_serverFn/abc", "POST")).toBe(false);
    expect(serverFnFailed('{"p":{"k":["result","error"],"v":[{"t":2},{"t":25,"s":{"message":{"t":1,"s":"boom"}},"c":"$TSR/Error"}]}}')).toBe(true);
    expect(serverFnFailed('{"p":{"k":["result","error"],"v":[{"t":10},{"t":2,"s":1}]}}')).toBe(false);
  });
});
