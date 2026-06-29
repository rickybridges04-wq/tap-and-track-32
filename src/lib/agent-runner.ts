// Agent execution engine. Calls the LLM for a plan, then walks it step by step.
// Risky tools pause and queue an approval. Approving resumes the run.

import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { planAgentTask } from "@/lib/ai.functions";
import {
  AGENTS,
  RISKY_TOOLS,
  toolCatalogFor,
  type ToolName,
} from "@/lib/agents";
import {
  aid,
  getAgentRun,
  getAgentTask,
  getApproval,
  listApprovals,
  saveAgentRun,
  saveAgentTask,
  saveApproval,
  type AgentApproval,
  type AgentRun,
  type AgentTask,
  type ToolStep,
} from "@/lib/agent-store";
import { executeTool, summarizeAction } from "@/lib/agent-tools";
import { toast } from "sonner";

type Planner = (args: {
  data: {
    agentType: string;
    systemPrompt: string;
    toolCatalog: string;
    task: { title: string; description: string; context?: string };
    provider?: "lovable" | "anthropic";
    model?: string;
  };
}) => Promise<{
  agentSummary: string;
  plan: Array<{ tool: ToolName; reasoning: string; args: string }>;
  finalReport: string;
}>;

function readProvider(): "lovable" | "anthropic" {
  if (typeof window === "undefined") return "lovable";
  try {
    const v = window.localStorage.getItem("bridges.agentProvider");
    return v === "anthropic" ? "anthropic" : "lovable";
  } catch {
    return "lovable";
  }
}


async function startRunInternal(task: AgentTask, planner: Planner): Promise<AgentRun> {
  const agentDef = AGENTS[task.agentType];
  task = { ...task, status: "running", updatedAt: new Date().toISOString() };
  saveAgentTask(task);

  const run: AgentRun = {
    id: aid("arun"),
    taskId: task.id,
    agentType: task.agentType,
    input: { title: task.title, description: task.description },
    status: "running",
    approvalRequired: false,
    steps: [],
    retries: 0,
    createdAt: new Date().toISOString(),
  };
  saveAgentRun(run);

  const provider = readProvider();
  let result;
  try {
    result = await planner({
      data: {
        agentType: task.agentType,
        systemPrompt: agentDef.systemPrompt,
        toolCatalog: toolCatalogFor(task.agentType),
        task: { title: task.title, description: task.description },
        provider,
      },
    });
  } catch (err) {
    // single retry
    try {
      result = await planner({
        data: {
          agentType: task.agentType,
          systemPrompt: agentDef.systemPrompt,
          toolCatalog: toolCatalogFor(task.agentType),
          task: { title: task.title, description: task.description },
          provider,
        },
      });
      run.retries = 1;
    } catch (err2) {
      run.status = "failed";
      run.output = `## Agent failed\n\n\`\`\`\n${(err2 as Error).message}\n\`\`\``;
      run.completedAt = new Date().toISOString();
      saveAgentRun(run);
      saveAgentTask({ ...task, status: "failed", updatedAt: new Date().toISOString() });
      return run;
    }
  }


  run.agentSummary = result.agentSummary;
  run.output = result.finalReport;

  // Filter out tools the agent isn't allowed to use.
  const allowed = new Set(agentDef.tools);
  const planSteps = result.plan
    .filter((s) => allowed.has(s.tool as ToolName))
    .slice(0, 8);

  run.steps = planSteps.map((s, i) => ({
    id: aid("step"),
    idx: i + 1,
    tool: s.tool,
    args: safeParse(s.args),
    reasoning: s.reasoning,
    status: "queued",
    startedAt: new Date().toISOString(),
    risky: !!RISKY_TOOLS[s.tool as ToolName],
  }));

  saveAgentRun(run);
  return await advanceRun(run.id);
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// Walk queued steps. Stops when a risky one is reached (queues approval).
export async function advanceRun(runId: string): Promise<AgentRun> {
  let run = getAgentRun(runId);
  if (!run) throw new Error("Run not found");

  for (const step of run.steps) {
    if (step.status === "ran" || step.status === "approved" || step.status === "rejected") continue;
    if (step.status === "needs_approval") {
      run.status = "needs_approval";
      run.approvalRequired = true;
      saveAgentRun(run);
      const task = getAgentTask(run.taskId);
      if (task) saveAgentTask({ ...task, status: "needs_approval", updatedAt: new Date().toISOString() });
      return run;
    }

    if (step.risky) {
      // Queue approval and pause.
      step.status = "needs_approval";
      const approval: AgentApproval = {
        id: aid("appr"),
        runId: run.id,
        stepId: step.id,
        taskId: run.taskId,
        actionSummary: summarizeAction(step.tool as ToolName, JSON.stringify(step.args ?? {})),
        riskLevel: "high",
        payload: step.args,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      saveApproval(approval);
      run.approvalRequired = true;
      run.status = "needs_approval";
      saveAgentRun(run);
      const task = getAgentTask(run.taskId);
      if (task) saveAgentTask({ ...task, status: "needs_approval", updatedAt: new Date().toISOString() });
      return run;
    }

    // Execute safe tool inline.
    const res = await executeTool(step.tool as ToolName, JSON.stringify(step.args ?? {}));
    step.result = res;
    step.status = res.ok ? "ran" : "failed";
    step.finishedAt = new Date().toISOString();
    saveAgentRun(run);
  }

  // All steps complete (or empty plan).
  run.status = "completed";
  run.completedAt = new Date().toISOString();
  saveAgentRun(run);
  const task = getAgentTask(run.taskId);
  if (task) saveAgentTask({ ...task, status: "completed", updatedAt: new Date().toISOString() });
  return run;
}

export async function decideApproval(approvalId: string, decision: "approved" | "rejected") {
  const a = getApproval(approvalId);
  if (!a) return;
  saveApproval({
    ...a,
    status: decision,
    decidedAt: new Date().toISOString(),
    approvedBy: "local-user",
  });
  const run = getAgentRun(a.runId);
  if (!run) return;
  const step = run.steps.find((s) => s.id === a.stepId);
  if (!step) return;

  if (decision === "rejected") {
    step.status = "rejected";
    step.result = { ok: false, message: "Rejected by user." };
    step.finishedAt = new Date().toISOString();
    saveAgentRun(run);
    // Continue with remaining steps.
    await advanceRun(run.id);
    return;
  }

  // Approved — execute the risky tool now (still simulated; no external call fires).
  step.status = "approved";
  step.result = {
    ok: true,
    message: `Approved by user. (Simulated execution — no external service called.)`,
    payload: step.args,
  };
  step.finishedAt = new Date().toISOString();
  saveAgentRun(run);
  await advanceRun(run.id);
}

// React hooks
export function useStartAgentRun() {
  const planner = useServerFn(planAgentTask) as unknown as Planner;
  return useCallback(
    async (task: AgentTask) => {
      try {
        const r = await startRunInternal(task, planner);
        if (r.status === "needs_approval") {
          toast.warning("Agent needs your approval", {
            description: r.steps.find((s) => s.status === "needs_approval")?.tool,
          });
        } else if (r.status === "completed") {
          toast.success(`${AGENTS[task.agentType].name} finished`);
        } else if (r.status === "failed") {
          toast.error(`${AGENTS[task.agentType].name} failed`);
        }
        return r;
      } catch (e) {
        toast.error("Agent error", { description: (e as Error).message });
        throw e;
      }
    },
    [planner],
  );
}

export function useResumeAgentRun() {
  return useCallback(async (runId: string) => {
    return advanceRun(runId);
  }, []);
}

export function pendingApprovalsForRun(runId: string) {
  return listApprovals().filter((a) => a.runId === runId && a.status === "pending");
}
