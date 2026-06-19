// Local-only secret store. Stopgap until Lovable Cloud secrets are wired in.
// Values live in this browser's localStorage; never send these to telemetry.
import { useEffect, useState } from "react";

const PREFIX = "bridges.secrets.v1.";

export function getSecret(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PREFIX + name);
  } catch {
    return null;
  }
}

export function setSecret(name: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + name, value);
    window.dispatchEvent(new CustomEvent("bridges:secrets-changed", { detail: { name } }));
  } catch {
    /* ignore */
  }
}

export function clearSecret(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + name);
    window.dispatchEvent(new CustomEvent("bridges:secrets-changed", { detail: { name } }));
  } catch {
    /* ignore */
  }
}

export function listSecrets(): Array<{ name: string; hasValue: boolean }> {
  if (typeof window === "undefined") return [];
  const out: Array<{ name: string; hasValue: boolean }> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      out.push({ name: k.slice(PREFIX.length), hasValue: !!window.localStorage.getItem(k) });
    }
  }
  return out;
}

/** Reactive hook — re-renders on save/clear from any component. */
export function useSecret(name: string): string | null {
  const [value, setValue] = useState<string | null>(() => getSecret(name));
  useEffect(() => {
    setValue(getSecret(name));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { name?: string } | undefined;
      if (!detail?.name || detail.name === name) setValue(getSecret(name));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFIX + name) setValue(getSecret(name));
    };
    window.addEventListener("bridges:secrets-changed", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("bridges:secrets-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [name]);
  return value;
}
