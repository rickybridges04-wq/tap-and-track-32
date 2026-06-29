// Client-side store backed by localStorage.
// TEMPORARY: this exists so the UI is fully usable while Lovable Cloud
// (Postgres + auth + storage) is not yet enabled on this project.
// When Cloud is on, replace these helpers with server functions.

export type RunStatus = "queued" | "running" | "done" | "failed";
export type StepStatus = "pass" | "fail" | "warn";
export type Trigger = "manual" | "schedule" | "webhook";
export type Severity = "low" | "medium" | "high";
export type FindingStatus = "open" | "ignored" | "resolved";

export type Project = {
  id: string;
  name: string;
  baseUrl: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  schedule?: { cron: string; enabled: boolean };
};

export type RunStep = {
  id: string;
  idx: number;
  pageUrl: string;
  element: string;
  action: string;
  status: StepStatus;
  screenshot?: string; // placeholder URL
  consoleErrors: string[];
  networkErrors: string[];
  note?: string;
};

export type Finding = {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  status: FindingStatus;
};

export type Run = {
  id: string;
  projectId: string;
  status: RunStatus;
  trigger: Trigger;
  startedAt: string;
  finishedAt?: string;
  steps: RunStep[];
  findings: Finding[];
  report?: string; // markdown
  stats: { pass: number; fail: number; warn: number };
};

const K_PROJECTS = "bridges.projects.v1";
const K_RUNS = "bridges.runs.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("bridges:store"));
}

export function listProjects(): Project[] {
  return read<Project[]>(K_PROJECTS, []);
}

export function getProject(id: string): Project | undefined {
  return listProjects().find((p) => p.id === id);
}

export function upsertProject(p: Project) {
  const all = listProjects();
  const i = all.findIndex((x) => x.id === p.id);
  if (i === -1) all.unshift(p);
  else all[i] = p;
  write(K_PROJECTS, all);
}

export function deleteProject(id: string) {
  write(
    K_PROJECTS,
    listProjects().filter((p) => p.id !== id),
  );
  write(
    K_RUNS,
    listRuns().filter((r) => r.projectId !== id),
  );
}

export function listRuns(): Run[] {
  return read<Run[]>(K_RUNS, []);
}

export function getRun(id: string): Run | undefined {
  return listRuns().find((r) => r.id === id);
}

export function runsForProject(projectId: string): Run[] {
  return listRuns()
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function saveRun(r: Run) {
  const all = listRuns();
  const i = all.findIndex((x) => x.id === r.id);
  if (i === -1) all.unshift(r);
  else all[i] = r;
  write(K_RUNS, all);
}

export function deleteRun(id: string) {
  write(K_RUNS, listRuns().filter((r) => r.id !== id));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Mock run generator — produces realistic-looking steps + findings.
// Replace with real Browserbase worker output once Cloud + secrets are configured.
export function simulateRun(projectId: string, trigger: Trigger = "manual"): Run {
  const proj = getProject(projectId);
  const base = proj?.baseUrl || "https://example.com";
  const pages = ["/", "/about", "/pricing", "/dashboard", "/settings"];
  const elements = [
    { el: "Primary CTA button", action: "click" },
    { el: "Nav link: Pricing", action: "click" },
    { el: "Email input", action: "fill" },
    { el: "Submit form", action: "submit" },
    { el: "Tab: Account", action: "click" },
    { el: "Dropdown: Profile", action: "open" },
    { el: "Toggle: Dark mode", action: "click" },
    { el: "Link: Docs", action: "click" },
  ];

  const steps: RunStep[] = [];
  let pass = 0,
    fail = 0,
    warn = 0;
  for (let i = 0; i < 14; i++) {
    const page = pages[i % pages.length];
    const e = elements[i % elements.length];
    const roll = Math.random();
    const status: StepStatus = roll > 0.85 ? "fail" : roll > 0.7 ? "warn" : "pass";
    if (status === "pass") pass++;
    else if (status === "fail") fail++;
    else warn++;
    steps.push({
      id: uid("step"),
      idx: i + 1,
      pageUrl: base + page,
      element: e.el,
      action: e.action,
      status,
      screenshot: `https://placehold.co/800x500/0f172a/e2e8f0?text=${encodeURIComponent(e.el)}`,
      consoleErrors:
        status === "fail"
          ? ["TypeError: Cannot read properties of undefined (reading 'id')"]
          : [],
      networkErrors: status === "fail" ? ["GET /api/user → 500"] : [],
    });
  }

  const findings: Finding[] = [];
  if (fail > 0)
    findings.push({
      id: uid("f"),
      severity: "high",
      title: "Broken interaction detected",
      body: `${fail} element interactions failed during the walkthrough. Inspect the failing steps for stack traces.`,
      status: "open",
    });
  if (warn > 0)
    findings.push({
      id: uid("f"),
      severity: "medium",
      title: "Confusing flow",
      body: `${warn} steps produced unexpected navigation or console warnings. Consider clarifying labels.`,
      status: "open",
    });
  findings.push({
    id: uid("f"),
    severity: "low",
    title: "Accessibility: missing labels",
    body: "Form inputs lacked associated <label> elements on 2 pages.",
    status: "open",
  });

  const report = `# Usability report

Walked **${steps.length}** elements across **${new Set(steps.map((s) => s.pageUrl)).size}** pages.

**Result:** ${pass} pass · ${warn} warn · ${fail} fail.

## Highlights
- Primary navigation works on every page tested.
- ${fail > 0 ? "Critical: a primary flow throws an unhandled error — see failing steps." : "No critical interaction failures."}
- ${warn > 0 ? "Several flows produced unexpected behavior worth a manual review." : "Minor flows behaved as expected."}

## Recommendations
1. Add error boundaries around the failing components.
2. Improve label clarity on form CTAs.
3. Add aria-labels to icon-only buttons.

_Generated by Bridges Tester (simulated — connect Lovable Cloud + Browserbase for real runs)._
`;

  const run: Run = {
    id: uid("run"),
    projectId,
    status: "done",
    trigger,
    startedAt: new Date().toISOString(),
    finishedAt: new Date(Date.now() + 1000 * 60 * 2).toISOString(),
    steps,
    findings,
    report,
    stats: { pass, fail, warn },
  };
  saveRun(run);
  return run;
}

import { useEffect, useState } from "react";
export function useStoreVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const h = () => setV((x) => x + 1);
    window.addEventListener("bridges:store", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("bridges:store", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return v;
}
