import type { AgentType } from "@/lib/agent-store";

export type AgentDef = {
  id: AgentType;
  name: string;
  emoji: string;
  short: string;
  color: string;
  systemPrompt: string;
  tools: ToolName[];
};

export type ToolName =
  | "readTable"
  | "listProjects"
  | "listRuns"
  | "listErrors"
  | "runBridgesTester"
  | "proposePlan"
  | "markResolved"
  | "updateRow"
  | "deleteRow"
  | "sendEmail"
  | "chargeMoney"
  | "deploy"
  | "updateProdSetting";

export const RISKY_TOOLS: Record<ToolName, boolean> = {
  readTable: false,
  listProjects: false,
  listRuns: false,
  listErrors: false,
  runBridgesTester: false,
  proposePlan: false,
  markResolved: false,
  updateRow: true,
  deleteRow: true,
  sendEmail: true,
  chargeMoney: true,
  deploy: true,
  updateProdSetting: true,
};

const SAFE_READ: ToolName[] = [
  "readTable",
  "listProjects",
  "listRuns",
  "listErrors",
  "proposePlan",
];

export const AGENTS: Record<AgentType, AgentDef> = {
  debug: {
    id: "debug",
    name: "Debug Agent",
    emoji: "🐛",
    short: "Bugs, errors, failed runs",
    color: "text-rose-500",
    systemPrompt:
      "You are the Debug Agent for Bridges AI Enterprises. You diagnose bugs, runtime errors, and failed jobs. Read the errors and runs tables first. Recommend a concrete fix. Verify before action. Never guess.",
    tools: [...SAFE_READ, "runBridgesTester", "markResolved", "updateRow"],
  },
  research: {
    id: "research",
    name: "Research Agent",
    emoji: "🔎",
    short: "Missing data, knowledge gaps",
    color: "text-sky-500",
    systemPrompt:
      "You are the Research / Knowledge Agent. Gather facts before answering. Cite which table you read. Never invent citations or assume missing information.",
    tools: [...SAFE_READ],
  },
  ceo: {
    id: "ceo",
    name: "CEO Agent",
    emoji: "🧭",
    short: "Business decisions, prioritization",
    color: "text-amber-500",
    systemPrompt:
      "You are the CEO Agent. Decide priorities and direction in line with Bridges AI Enterprises' mission and values: family, God, integrity. Ask: is this honest, ethical, protective of values, and supportive of long-term value?",
    tools: [...SAFE_READ, "proposePlan"],
  },
  cfo: {
    id: "cfo",
    name: "CFO Agent",
    emoji: "💰",
    short: "Money, pricing, billing",
    color: "text-emerald-500",
    systemPrompt:
      "You are the CFO Agent. Handle money, pricing, billing. Never spend money, approve refunds, or change billing without explicit approval. Prepare drafts labeled DRAFT — PENDING APPROVAL.",
    tools: [...SAFE_READ, "proposePlan", "chargeMoney", "sendEmail"],
  },
  marketing: {
    id: "marketing",
    name: "Marketing Agent",
    emoji: "📣",
    short: "Content, copy, campaigns",
    color: "text-fuchsia-500",
    systemPrompt:
      "You are the Marketing Agent. Draft on-brand copy, campaigns, and content plans. Keep voice consistent with Bridges AI Enterprises.",
    tools: [...SAFE_READ, "proposePlan", "sendEmail"],
  },
  architect: {
    id: "architect",
    name: "Software Architect",
    emoji: "🏗️",
    short: "App structure, code, schema",
    color: "text-indigo-500",
    systemPrompt:
      "You are the Software Architect Agent. Recommend changes to app structure, code organization, and database schema. Preserve working systems unless the user requests otherwise. Never deploy without approval.",
    tools: [...SAFE_READ, "proposePlan", "deploy", "updateProdSetting", "updateRow"],
  },
  pm: {
    id: "pm",
    name: "Project Manager",
    emoji: "📋",
    short: "Task planning, breakdowns",
    color: "text-violet-500",
    systemPrompt:
      "You are the Project Manager Agent. Break work into small, ordered, owner-tagged tasks. Surface blockers. Recommend next actions.",
    tools: [...SAFE_READ, "proposePlan", "markResolved", "updateRow"],
  },
  sre: {
    id: "sre",
    name: "SRE / Reliability Engineer",
    emoji: "🛰️",
    short: "Uptime, incidents, error budgets",
    color: "text-cyan-500",
    systemPrompt:
      "You are the SRE / Reliability Engineer. Your job is to keep the app up at 100k+ users. Watch errors, failed jobs, retry storms, latency spikes, and queue backlogs. Define SLOs and error budgets. Recommend circuit breakers, retries with backoff, and graceful degradation. Never change production settings without explicit approval.",
    tools: [...SAFE_READ, "listErrors", "runBridgesTester", "markResolved", "updateProdSetting"],
  },
  perf: {
    id: "perf",
    name: "Performance Engineer",
    emoji: "⚡",
    short: "Latency, bundle size, query cost",
    color: "text-yellow-500",
    systemPrompt:
      "You are the Performance Engineer. Own the speed budget. At 100k users a 200ms query becomes a 5-minute backlog. Profile bundle size, render times, p95/p99 latency, N+1 queries, missing indexes, cache hit rates, and oversized payloads. Recommend pagination, memoization, indexes, and CDN/caching strategies. Quantify before/after.",
    tools: [...SAFE_READ, "listRuns", "listErrors", "proposePlan"],
  },
  security: {
    id: "security",
    name: "Security & Compliance Officer",
    emoji: "🔐",
    short: "Authn/z, PII, RLS, audit, compliance",
    color: "text-red-500",
    systemPrompt:
      "You are the Security & Compliance Officer. One leak at scale is a company-ending event. Audit auth flows, RLS policies, secret handling, PII exposure (URLs, logs, error messages), CORS, CSRF, third-party trackers, and dependency CVEs. Verify GDPR/CCPA basics: consent, export, delete. Never change production settings without explicit approval.",
    tools: [...SAFE_READ, "listErrors", "proposePlan", "markResolved", "updateProdSetting"],
  },
};

// Keyword-first router (cheap). LLM fallback could be added later.
export function routeAgent(text: string): AgentType {
  const t = text.toLowerCase();
  if (/(bug|error|crash|broken|exception|stack|failed|fail|throw|null|undefined)/.test(t))
    return "debug";
  if (/(price|pricing|cost|invoice|refund|billing|money|stripe|subscription|charge|payout)/.test(t))
    return "cfo";
  if (/(market|content|copy|seo|campaign|landing|email|launch|social|brand)/.test(t))
    return "marketing";
  if (/(architecture|schema|database|migration|refactor|deploy|infra|api|endpoint|component)/.test(t))
    return "architect";
  if (/(plan|task|breakdown|roadmap|milestone|sprint|backlog)/.test(t)) return "pm";
  if (/(decide|priority|strategy|direction|business|vision)/.test(t)) return "ceo";
  if (/(research|find|look up|knowledge|missing|info|data on)/.test(t)) return "research";
  return "pm";
}

export function toolCatalogFor(agent: AgentType): string {
  const def = AGENTS[agent];
  const lines = def.tools.map((tn) => {
    const risky = RISKY_TOOLS[tn] ? " (RISKY — requires approval)" : "";
    return `- ${tn}${risky}: ${TOOL_DESCRIPTIONS[tn]}`;
  });
  return lines.join("\n");
}

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  readTable:
    "Read rows from a localStorage table. args: { table: 'projects'|'runs'|'errors'|'agent_tasks'|'agent_runs', limit?: number }",
  listProjects: "List all tested apps. args: {}",
  listRuns: "List recent Bridges Tester runs. args: { projectId?: string }",
  listErrors: "List captured frontend/backend errors. args: { status?: 'open'|'resolved' }",
  runBridgesTester: "Trigger a usability walkthrough on a project. args: { projectId: string }",
  proposePlan: "Save a step-by-step plan for the user. args: { steps: string[] }",
  markResolved: "Mark an error as resolved. args: { errorId: string }",
  updateRow: "Update a row. args: { table: string, id: string, patch: object }",
  deleteRow: "Delete a row. args: { table: string, id: string }",
  sendEmail: "Send an email. args: { to: string, subject: string, body: string }",
  chargeMoney: "Create a charge. args: { amount: number, currency: string, customerId: string }",
  deploy: "Deploy a release. args: { environment: 'staging'|'production', ref: string }",
  updateProdSetting:
    "Change a production configuration. args: { key: string, value: string }",
};
