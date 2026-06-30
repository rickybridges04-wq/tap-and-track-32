import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AGENTS, routeAgent } from "@/lib/agents";
import type { AgentType, TaskPriority, TaskSource } from "@/lib/agent-store";
import { enqueueTask } from "@/lib/agent-triggers";
import { useStartAgentRun } from "@/lib/agent-runner";
import { useSubscription, incrementRunsUsed } from "@/lib/subscription";
import { PaywallCard } from "@/components/PaywallCard";
import { Sparkles } from "lucide-react";

type Props = {
  trigger?: React.ReactNode;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultAgent?: AgentType;
  source?: TaskSource;
};

export function RunAgentDialog({
  trigger,
  defaultTitle = "",
  defaultDescription = "",
  defaultAgent,
  source = "user",
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [priority, setPriority] = useState<TaskPriority>("med");
  const [agent, setAgent] = useState<AgentType | "auto">(defaultAgent ?? "auto");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const startRun = useStartAgentRun();
  const sub = useSubscription();

  const suggested = agent === "auto" ? routeAgent(`${title} ${description}`) : agent;

  async function submit() {
    if (!title.trim() && !description.trim()) return;
    if (!sub.canRun) return;
    setBusy(true);
    try {
      const task = enqueueTask({
        title: title.trim() || description.trim().slice(0, 80),
        description: description.trim() || title.trim(),
        priority,
        agentType: suggested,
        source,
      });
      if (!sub.active) incrementRunsUsed();
      setOpen(false);
      startRun(task).catch(() => {});
      navigate({ to: "/agents/$taskId", params: { taskId: task.id } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Sparkles className="mr-1 h-4 w-4" /> Run Agent
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run an agent</DialogTitle>
          <DialogDescription>
            Describe the problem, task, bug, or request. The router will pick the right agent — you can override it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="t">Title</Label>
            <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
          </div>
          <div>
            <Label htmlFor="d">Description</Label>
            <Textarea
              id="d"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to happen, what failed, links, IDs…"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="med">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Agent</Label>
              <Select value={agent} onValueChange={(v) => setAgent(v as AgentType | "auto")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-route (suggested: {AGENTS[suggested].name})</SelectItem>
                  {Object.values(AGENTS).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.emoji} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || (!title.trim() && !description.trim())}>
            {busy ? "Queueing…" : "Run agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
