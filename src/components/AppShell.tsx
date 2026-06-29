import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, FolderKanban, Settings, Zap, Bot, ShieldCheck, History, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RunAgentDialog } from "@/components/RunAgentDialog";
import { pendingApprovalCount, useAgentsVersion, useMounted } from "@/lib/agent-store";

const nav: Array<{ to: string; label: string; icon: typeof Activity; badge?: boolean }> = [
  { to: "/", label: "Dashboard", icon: Activity },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/qa", label: "Synapse QA OS", icon: Sparkles },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/agents/approvals", label: "Approvals", icon: ShieldCheck, badge: true },
  { to: "/agents/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useAgentsVersion();
  const mounted = useMounted();
  const pending = mounted ? pendingApprovalCount() : 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Bridges Ops</div>
            <div className="text-xs text-muted-foreground">Tester + Agents</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-2">
          {nav.map((n) => {
            const active =
              n.to === "/"
                ? path === "/"
                : n.to === "/agents"
                  ? path === "/agents" || (path.startsWith("/agents/") && !path.startsWith("/agents/approvals") && !path.startsWith("/agents/history"))
                  : path === n.to || path.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to as never}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <span className="flex items-center gap-2">
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </span>
                {n.badge && pending > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 text-xs font-medium text-amber-700">
                    {pending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 px-3 pb-4">
          <RunAgentDialog />
          <div className="px-2 text-xs text-muted-foreground">v0.2 · agents</div>
        </div>
      </aside>
      <main className="md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
