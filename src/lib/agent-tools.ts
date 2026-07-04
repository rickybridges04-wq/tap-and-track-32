// Tool implementations. Safe reads use localStorage; risky/real-world tools call server fns.
import type { ToolName } from "@/lib/agents";
import { listProjects, listRuns, simulateRun } from "@/lib/store";
import {
  listAgentRuns,
  listAgentTasks,
  listErrors,
  saveError,
  type ErrorRecord,
} from "@/lib/agent-store";
import {
  runTester,
  sendEmail as sendEmailFn,
  chargeMoney as chargeMoneyFn,
  updateRow as updateRowFn,
  deleteRow as deleteRowFn,
} from "@/lib/agent-tools.functions";

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
      const explicitUrl = typeof args.url === "string" ? args.url : "";
      const id = String(args.projectId || "");
      const projects = listProjects();
      const target = projects.find((p) => p.id === id) ?? projects[0];
      const url = explicitUrl || target?.baseUrl;
      if (!url) return { ok: false, message: "No target URL — pass args.url or add a project with a baseUrl." };
      // Record a local run row so history stays coherent.
      const stub = target ? simulateRun(target.id, "manual") : null;
      const res = await runTester({ data: { url, maxClicks: 3 } });
      return {
        ok: res.ok,
        data: { ...(res.data ?? {}), runId: stub?.id },
        message: res.message,
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
    case "sendEmail": {
      return sendEmailFn({
        data: {
          to: String(args.to ?? ""),
          subject: String(args.subject ?? ""),
          html: String(args.html ?? args.body ?? ""),
          from: args.from ? String(args.from) : "Bridges Ops <onboarding@resend.dev>",
        },
      });
    }
    case "chargeMoney": {
      return chargeMoneyFn({
        data: {
          amount: Number(args.amount ?? 0),
          currency: String(args.currency ?? "usd"),
          customerId: String(args.customerId ?? ""),
          description: args.description ? String(args.description) : undefined,
        },
      });
    }
    case "updateRow": {
      return updateRowFn({
        data: {
          table: args.table,
          id: String(args.id ?? ""),
          patch: (args.patch ?? {}) as Record<string, unknown>,
        },
      });
    }
    case "deleteRow": {
      return deleteRowFn({ data: { table: args.table, id: String(args.id ?? "") } });
    }
    case "deploy":
      return { ok: false, message: "deploy tool is not wired to a deploy provider." };
    case "updateProdSetting":
      return { ok: false, message: "updateProdSetting tool is not wired to a provider." };
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
