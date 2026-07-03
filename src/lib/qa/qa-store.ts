// Synapse QA OS — client-side store (localStorage). Matches existing agent-store pattern.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { PersonaId } from "./personas";

const NS = "synapse-qa.v1";
const EVT = "synapse-qa:changed";

export type Severity = "critical" | "high" | "medium" | "low";
export type Category = "functional" | "visual" | "accessibility" | "performance";

export type QaPage = {
  url: string;
  title?: string;
  status?: number;
  links: string[];
  screenshot?: string;
  markdownPreview?: string;
};

export type QaFinding = {
  id: string;
  runId: string;
  personaId: PersonaId | "crawler";
  pageUrl: string;
  category: Category;
  severity: Severity;
  confidence: number; // 0-1
  title: string;
  detail: string;
  suggestion?: string;
};

export type QaRunStatus =
  | "pending"
  | "mapping"
  | "scraping"
  | "inspecting"
  | "completed"
  | "failed";

export type QaRun = {
  id: string;
  url: string;
  depth: "quick" | "standard" | "deep";
  personas: PersonaId[];
  status: QaRunStatus;
  progress: { stage: string; pct: number };
  pages: QaPage[];
  findings: QaFinding[];
  score?: number;
  verdict?: "ready" | "minor" | "major" | "block";
  error?: string;
  warnings?: string[];
  createdAt: string;
  completedAt?: string;
};

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVT));
}

function readAll(): QaRun[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(NS) || "[]") as QaRun[];
  } catch {
    return [];
  }
}

function writeAll(runs: QaRun[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NS, JSON.stringify(runs));
  emit();
}

export function listRuns(): QaRun[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRun(id: string): QaRun | undefined {
  return readAll().find((r) => r.id === id);
}

export function saveRun(run: QaRun) {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === run.id);
  if (idx >= 0) all[idx] = run;
  else all.push(run);
  writeAll(all);
}

export function deleteRun(id: string) {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function qaid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

// React hooks
export function useQaRuns(): QaRun[] {
  const subscribe = (cb: () => void) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(EVT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(EVT, cb);
      window.removeEventListener("storage", cb);
    };
  };
  const get = () => (typeof window === "undefined" ? "[]" : localStorage.getItem(NS) || "[]");
  const snap = useSyncExternalStore(subscribe, get, () => "[]");
  // parse outside snapshot to keep referential stability? simpler:
  // We re-parse on each render — runs list is small.
  void snap;
  return listRuns();
}

export function useQaRun(id: string): QaRun | undefined {
  const runs = useQaRuns();
  return runs.find((r) => r.id === id);
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
