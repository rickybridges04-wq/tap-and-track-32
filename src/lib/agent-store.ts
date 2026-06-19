// Extend store with agent system tables. Append-only — keeps existing exports stable.
import { useEffect, useState } from "react";

export type AgentType =
  | "debug"
  | "research"
  | "ceo"
  | "cfo"
  | "marketing"
  | "architect"
  | "pm";

export type TaskStatus =
  | "pending"
  | "running"
  | "needs_approval"
  | "completed"
  | "failed";

export type TaskPriority = "low" | "med" | "high";
export type TaskSource = "user" | "db" | "error" | "webhook" | "schedule";
export type RiskLevel = "low" | "med" | "high";

export type AgentTask = {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  agentType: AgentType;
  source: TaskSource;
  createdAt: string;
  updatedAt: string;
};

export type ToolStep = {
  id: string;
  idx: number;
  tool: string;
  args: unknown;
  reasoning?: string;
  result?: unknown;
  status: "queued" | "ran" | "needs_approval" | "approved" | "rejected" | "failed";
  startedAt: string;
  finishedAt?: string;
  risky: boolean;
};

export type AgentRun = {
  id: string;
  taskId: string;
  agentType: AgentType;
  input: { title: string; description: string };
  agentSummary?: string;
  output?: string; // final markdown report
  status: TaskStatus;
  approvalRequired: boolean;
  steps: ToolStep[];
  retries: number;
  createdAt: string;
  completedAt?: string;
};

export type AgentApproval = {
  id: string;
  runId: string;
  stepId: string;
  taskId: string;
  actionSummary: string;
  riskLevel: RiskLevel;
  payload: unknown;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  createdAt: string;
  decidedAt?: string;
};

export type ErrorRecord = {
  id: string;
  userId: string;
  source: "frontend" | "backend";
  message: string;
  stack?: string;
  status: "open" | "triaged" | "resolved";
  route?: string;
  createdAt: string;
};

const K = {
  tasks: "bridges.agent_tasks.v1",
  runs: "bridges.agent_runs.v1",
  approvals: "bridges.agent_approvals.v1",
  errors: "bridges.errors.v1",
  lastSweep: "bridges.lastSweep.v1",
} as const;

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
  window.dispatchEvent(new CustomEvent("bridges:agents"));
}

export const USER_ID = "local-user";

export function listAgentTasks(): AgentTask[] {
  return read<AgentTask[]>(K.tasks, []).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}
export function getAgentTask(id: string) {
  return listAgentTasks().find((t) => t.id === id);
}
export function saveAgentTask(t: AgentTask) {
  const all = read<AgentTask[]>(K.tasks, []);
  const i = all.findIndex((x) => x.id === t.id);
  if (i === -1) all.unshift(t);
  else all[i] = t;
  write(K.tasks, all);
}

export function listAgentRuns(): AgentRun[] {
  return read<AgentRun[]>(K.runs, []).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}
export function getAgentRun(id: string) {
  return listAgentRuns().find((r) => r.id === id);
}
export function runForTask(taskId: string) {
  return listAgentRuns().find((r) => r.taskId === taskId);
}
export function saveAgentRun(r: AgentRun) {
  const all = read<AgentRun[]>(K.runs, []);
  const i = all.findIndex((x) => x.id === r.id);
  if (i === -1) all.unshift(r);
  else all[i] = r;
  write(K.runs, all);
}

export function listApprovals(): AgentApproval[] {
  return read<AgentApproval[]>(K.approvals, []).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}
export function getApproval(id: string) {
  return listApprovals().find((a) => a.id === id);
}
export function saveApproval(a: AgentApproval) {
  const all = read<AgentApproval[]>(K.approvals, []);
  const i = all.findIndex((x) => x.id === a.id);
  if (i === -1) all.unshift(a);
  else all[i] = a;
  write(K.approvals, all);
}
export function pendingApprovalCount() {
  return listApprovals().filter((a) => a.status === "pending").length;
}

export function listErrors(): ErrorRecord[] {
  return read<ErrorRecord[]>(K.errors, []).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}
export function getError(id: string) {
  return listErrors().find((e) => e.id === id);
}
export function saveError(e: ErrorRecord) {
  const all = read<ErrorRecord[]>(K.errors, []);
  const i = all.findIndex((x) => x.id === e.id);
  if (i === -1) all.unshift(e);
  else all[i] = e;
  write(K.errors, all);
}

export function getLastSweep(): number {
  return read<number>(K.lastSweep, 0);
}
export function setLastSweep(ts: number) {
  write(K.lastSweep, ts);
}

export function aid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useAgentsVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const h = () => setV((x) => x + 1);
    window.addEventListener("bridges:agents", h);
    window.addEventListener("bridges:store", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("bridges:agents", h);
      window.removeEventListener("bridges:store", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return v;
}

// Hydration-safe mount flag (used to prevent SSR/CSR mismatch on store-backed pages).
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
