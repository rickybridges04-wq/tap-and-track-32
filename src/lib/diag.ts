// Lightweight developer diagnostics bus. Captures the most recent
// backend/function error so the /diagnostics panel can display it.

export type DiagEntry = {
  at: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  functionName?: string;
  sql?: string;
  route?: string;
};

const KEY = "__bridges_last_diag_error";

export function recordDiag(err: unknown, ctx: { functionName?: string; sql?: string } = {}) {
  try {
    const e = err as any;
    const entry: DiagEntry = {
      at: new Date().toISOString(),
      message: e?.message ?? String(err),
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
      functionName: ctx.functionName,
      sql: ctx.sql,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    };
    if (typeof window !== "undefined") {
      (window as any)[KEY] = entry;
      try { sessionStorage.setItem(KEY, JSON.stringify(entry)); } catch {}
      window.dispatchEvent(new CustomEvent("bridges:diag", { detail: entry }));
    }
    return entry;
  } catch {
    return null;
  }
}

export function getLastDiag(): DiagEntry | null {
  if (typeof window === "undefined") return null;
  const mem = (window as any)[KEY];
  if (mem) return mem;
  try {
    const s = sessionStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function installDiagGlobals() {
  if (typeof window === "undefined") return;
  if ((window as any).__bridgesDiagInstalled) return;
  (window as any).__bridgesDiagInstalled = true;
  (window as any).__bridgesRecordDiag = recordDiag;
  window.addEventListener("unhandledrejection", (ev) => {
    const reason: any = ev.reason;
    const msg: string = reason?.message ?? String(reason);
    if (/permission denied|row-level security|violates|policy|function .* does not exist|JWT|Unauthorized/i.test(msg)) {
      recordDiag(reason);
    }
  });
}
