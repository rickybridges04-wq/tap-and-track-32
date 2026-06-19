import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/lib/agent-store";

const map: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-foreground" },
  running: { label: "Running", className: "bg-sky-500/15 text-sky-600" },
  needs_approval: { label: "Needs approval", className: "bg-amber-500/15 text-amber-700" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-600" },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive" },
};

export function AgentStatusBadge({ status }: { status: TaskStatus }) {
  const m = map[status];
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
}
