// Wires up triggers 2 (DB), 3 (error), 5 (scheduled) for the agent system.
// Mounted once from __root.tsx so it runs anywhere the app is open.
import { useEffect, useRef } from "react";
import { routeAgent } from "@/lib/agents";
import {
  aid,
  getLastSweep,
  listAgentTasks,
  listErrors,
  saveAgentTask,
  saveError,
  setLastSweep,
  USER_ID,
  type AgentTask,
  type ErrorRecord,
} from "@/lib/agent-store";
import { listProjects, listRuns } from "@/lib/store";

function newTask(partial: Partial<AgentTask> & { title: string; description: string; source: AgentTask["source"] }): AgentTask {
  const now = new Date().toISOString();
  const agentType = partial.agentType ?? routeAgent(`${partial.title} ${partial.description}`);
  return {
    id: aid("task"),
    userId: USER_ID,
    title: partial.title,
    description: partial.description,
    status: "pending",
    priority: partial.priority ?? "med",
    agentType,
    source: partial.source,
    createdAt: now,
    updatedAt: now,
  };
}

export function enqueueTask(partial: Parameters<typeof newTask>[0]): AgentTask {
  const t = newTask(partial);
  saveAgentTask(t);
  return t;
}

export function captureError(input: {
  message: string;
  stack?: string;
  source?: "frontend" | "backend";
  route?: string;
}): ErrorRecord {
  const now = new Date().toISOString();
  const rec: ErrorRecord = {
    id: aid("err"),
    userId: USER_ID,
    source: input.source ?? "frontend",
    message: input.message,
    stack: input.stack,
    route: input.route,
    status: "open",
    createdAt: now,
  };
  saveError(rec);
  // Auto-enqueue Debug Agent (Trigger 3).
  enqueueTask({
    title: `Frontend error: ${input.message.slice(0, 80)}`,
    description: `Auto-captured error on ${input.route ?? "unknown route"}.\n\n${input.stack ?? input.message}`,
    source: "error",
    agentType: "debug",
    priority: "high",
  });
  return rec;
}

if (typeof window !== "undefined") {
  // Expose so reportLovableError and FixThisButton can call without import cycles.
  (window as any).__bridgesCaptureError = captureError;
  (window as any).__bridgesEnqueueTask = enqueueTask;
}

export function AgentTriggersMount() {
  const lastTaskCountRef = useRef<number | null>(null);
  const lastErrorCountRef = useRef<number | null>(null);

  // Trigger 3: global window errors
  useEffect(() => {
    function onError(ev: ErrorEvent) {
      captureError({
        message: ev.message || "Unknown error",
        stack: ev.error?.stack,
        route: window.location.pathname,
      });
    }
    function onRejection(ev: PromiseRejectionEvent) {
      const reason = ev.reason;
      captureError({
        message: typeof reason === "string" ? reason : reason?.message ?? "Unhandled promise rejection",
        stack: reason?.stack,
        route: window.location.pathname,
      });
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // Trigger 5: scheduled sweeper every 60s
  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      if (now - getLastSweep() < 55_000) return;
      setLastSweep(now);

      const tasks = listAgentTasks();
      const stuck = tasks.filter(
        (t) =>
          t.status === "running" &&
          Date.now() - new Date(t.updatedAt).getTime() > 5 * 60_000,
      );
      if (stuck.length > 0) {
        enqueueTask({
          title: `Sweeper: ${stuck.length} stuck task(s)`,
          description: `Tasks have been in "running" state >5min: ${stuck.map((s) => s.id).join(", ")}.`,
          source: "schedule",
          agentType: "debug",
          priority: "med",
        });
      }

      const openErrs = listErrors().filter((e) => e.status === "open");
      if (openErrs.length >= 5) {
        enqueueTask({
          title: `Sweeper: ${openErrs.length} open error(s)`,
          description: "Open errors have accumulated. Triage and resolve.",
          source: "schedule",
          agentType: "debug",
          priority: "med",
        });
      }

      // Bridges Tester health: any failing run?
      const failingRuns = listRuns().filter((r) => r.stats.fail > 0);
      if (failingRuns.length > 0 && listProjects().length > 0) {
        // Just a heads-up — don't spam: only one per sweep window.
      }
    };
    sweep();
    const id = setInterval(sweep, 60_000);
    return () => clearInterval(id);
  }, []);

  // Trigger 2: DB-style watcher — new rows in agent_tasks/errors auto-route
  // (already happens at the source: enqueueTask/captureError. This effect
  //  also tracks counts so a manual localStorage edit is picked up.)
  useEffect(() => {
    function check() {
      const t = listAgentTasks();
      const e = listErrors();
      if (lastTaskCountRef.current == null) lastTaskCountRef.current = t.length;
      if (lastErrorCountRef.current == null) lastErrorCountRef.current = e.length;
      lastTaskCountRef.current = t.length;
      lastErrorCountRef.current = e.length;
    }
    window.addEventListener("bridges:agents", check);
    return () => window.removeEventListener("bridges:agents", check);
  }, []);

  return null;
}
