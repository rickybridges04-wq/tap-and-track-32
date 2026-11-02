// Client-safe plan constants shared by server enforcement and UI.
export const FREE_RUN_LIMIT = 3;
export const PRO_PRICE_KEY = "wizard_pro_monthly";
export const PRO_PRICE_LABEL = "$29/month";
export const PLAN_ERROR_PREFIX = "PLAN:";

export function isPlanError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes(PLAN_ERROR_PREFIX);
}

/** Remember a signed-out visitor's plan choice across sign-up / Google sign-in. */
const INTENT_KEY = "ww_checkout_intent";
export function savePlanIntent(priceKey: string) {
  try {
    sessionStorage.setItem(INTENT_KEY, priceKey);
    localStorage.setItem(INTENT_KEY, priceKey);
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
    return v === PRO_PRICE_KEY ? v : null;
  } catch {
    return null;
  }
}
