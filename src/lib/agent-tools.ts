// Tool implementations. Today these touch localStorage. Swap to Cloud later.
import type { ToolName } from "@/lib/agents";
import { listProjects, listRuns, simulateRun } from "@/lib/store";
import {
  listAgentRuns,
  listAgentTasks,
  listErrors,
  saveError,
  type ErrorRecord,
} from "@/lib/agent-store";

export type ToolExecResult = {
  ok: boolean;
  data?: unknown;
  message: string;
};

export async function executeTool(
  tool: ToolName,
  rawArgs: string,
): Promise<ToolExecResult> {
  let args: any = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { ok: false, message: `Invalid JSON args: ${rawArgs}` };
  }

  switch (tool) {
    case "listProjects": {
      const data = listProjects();
      return { ok: true, data, message: `Found ${data.length} project(s).` };
    }
    case "listRuns": {
      const all = listRuns();
      const data = args.projectId ? all.filter((r) => r.projectId === args.projectId) : all;
      return { ok: true, data: data.slice(0, 20), message: `Returned ${Math.min(data.length, 20)} run(s).` };
    }
    case "listErrors": {
      let data = listErrors();
      if (args.status) data = data.filter((e) => e.status === args.status);
      return { ok: true, data: data.slice(0, 50), message: `Returned ${Math.min(data.length, 50)} error(s).` };
    }
    case "readTable": {
      const t = String(args.table || "");
      const limit = Number(args.limit ?? 25);
      let data: unknown[] = [];
      if (t === "projects") data = listProjects();
      else if (t === "runs") data = listRuns();
      else if (t === "errors") data = listErrors();
      else if (t === "agent_tasks") data = listAgentTasks();
      else if (t === "agent_runs") data = listAgentRuns();
      else return { ok: false, message: `Unknown table: ${t}` };
      return { ok: true, data: data.slice(0, limit), message: `Read ${Math.min(data.length, limit)} row(s) from ${t}.` };
    }
    case "runBridgesTester": {
      const id = String(args.projectId || "");
      const projects = listProjects();
      const target = projects.find((p) => p.id === id) ?? projects[0];
      if (!target) return { ok: false, message: "No projects available to test." };
      const run = simulateRun(target.id, "manual");
      return {
        ok: true,
        data: { runId: run.id, stats: run.stats },
        message: `Bridges Tester run complete: ${run.stats.pass} pass / ${run.stats.warn} warn / ${run.stats.fail} fail.`,
      };
    }
    case "proposePlan": {
      const steps = Array.isArray(args.steps) ? args.steps.map(String) : [];
      return { ok: true, data: { steps }, message: `Proposed plan with ${steps.length} step(s).` };
    }
    case "markResolved": {
      const id = String(args.errorId || "");
      const err = listErrors().find((e) => e.id === id);
      if (!err) return { ok: false, message: `Error ${id} not found.` };
      const updated: ErrorRecord = { ...err, status: "resolved" };
      saveError(updated);
      return { ok: true, data: updated, message: `Marked ${id} as resolved.` };
    }
    // Risky tools never execute here — they should be intercepted upstream.
    case "updateRow":
    case "deleteRow":
    case "sendEmail":
    case "chargeMoney":
    case "deploy":
    case "updateProdSetting":
      return {
        ok: false,
        message: `Risky tool '${tool}' must be approved before execution.`,
      };
  }
}

export function summarizeAction(tool: ToolName, rawArgs: string): string {
  let args: any = {};
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {}
  switch (tool) {
    case "updateRow":
      return `Update ${args.table}/${args.id} → ${JSON.stringify(args.patch ?? {})}`;
    case "deleteRow":
      return `Delete ${args.table}/${args.id}`;
    case "sendEmail":
      return `Email "${args.subject ?? ""}" to ${args.to ?? ""}`;
    case "chargeMoney":
      return `Charge ${args.amount ?? "?"} ${args.currency ?? ""} to ${args.customerId ?? ""}`;
    case "deploy":
      return `Deploy ${args.ref ?? ""} → ${args.environment ?? ""}`;
    case "updateProdSetting":
      return `Set prod ${args.key ?? ""} = ${String(args.value ?? "")}`;
    default:
      return tool;
  }
}
