// Client-safe plan constants shared by server enforcement and UI.
// Prices are NOT here: they come from BAE HQ → Pricing via the gateway (getPlans).
export const FREE_RUN_LIMIT = 3;
export const PLAN_ERROR_PREFIX = "PLAN:";
const PLAN_KEY_RE = /^[a-z0-9_-]{2,80}$/;

export function isPlanError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes(PLAN_ERROR_PREFIX);
}

/** "$39" from 3900; drops ".00". */
export function formatPrice(cents: number): string {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

/** Remember a signed-out visitor's plan choice across sign-up / Google sign-in. */
const INTENT_KEY = "ww_checkout_intent";
export function savePlanIntent(planKey: string) {
  try {
    sessionStorage.setItem(INTENT_KEY, planKey);
    localStorage.setItem(INTENT_KEY, planKey);
  } catch {
    /* storage unavailable */
  }
}
/** Read and clear the intent so checkout opens exactly once. */
export function takePlanIntent(): string | null {
  try {
    const v = sessionStorage.getItem(INTENT_KEY) ?? localStorage.getItem(INTENT_KEY);
    sessionStorage.removeItem(INTENT_KEY);
    localStorage.removeItem(INTENT_KEY);
    return v && PLAN_KEY_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}
