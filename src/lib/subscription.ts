// Free-trial gate: 2 lifetime runs (QA + agent tasks combined), then paywall.
// localStorage-backed until Stripe webhooks promote the flag.
import { useEffect, useState } from "react";

const USAGE_KEY = "bridges.usage.runsUsed";
const SUB_KEY = "bridges.subscription.active";
export const FREE_RUN_LIMIT = 2;

export function getRunsUsed(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(window.localStorage.getItem(USAGE_KEY) || "0", 10) || 0;
}

export function incrementRunsUsed(): number {
  if (typeof window === "undefined") return 0;
  const next = getRunsUsed() + 1;
  window.localStorage.setItem(USAGE_KEY, String(next));
  window.dispatchEvent(new CustomEvent("bridges:sub-changed"));
  return next;
}

export function isSubscribed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SUB_KEY) === "true";
}

export function setSubscribed(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SUB_KEY, v ? "true" : "false");
  window.dispatchEvent(new CustomEvent("bridges:sub-changed"));
}

export function resetUsage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USAGE_KEY);
  window.dispatchEvent(new CustomEvent("bridges:sub-changed"));
}

export type SubState = {
  active: boolean;
  runsUsed: number;
  runsRemaining: number;
  canRun: boolean;
};

export function useSubscription(): SubState {
  const [state, setState] = useState<SubState>(() => compute());
  useEffect(() => {
    const update = () => setState(compute());
    update();
    window.addEventListener("bridges:sub-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("bridges:sub-changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return state;
}

function compute(): SubState {
  const active = isSubscribed();
  const runsUsed = getRunsUsed();
  const remaining = Math.max(0, FREE_RUN_LIMIT - runsUsed);
  return {
    active,
    runsUsed,
    runsRemaining: remaining,
    canRun: active || runsUsed < FREE_RUN_LIMIT,
  };
}
