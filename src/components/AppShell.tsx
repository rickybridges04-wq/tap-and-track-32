import { Link, useRouterState, Navigate } from "@tanstack/react-router";
import { Activity, FolderKanban, Settings, Zap, Bot, ShieldCheck, History, Sparkles, FlaskConical, Route as RouteIcon, Users, BookUser, Crown, LogOut, BarChart3, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RunAgentDialog } from "@/components/RunAgentDialog";
import { pendingApprovalCount, useAgentsVersion, useMounted } from "@/lib/agent-store";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/lib/subscription";

type NavItem = { to: string; label: string; icon: typeof Activity; badge?: boolean; ownerOnly?: boolean };

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Activity },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/qa", label: "Synapse QA OS", icon: Sparkles },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/roster/agents", label: "Agent roster", icon: BookUser },
  { to: "/roster/personas", label: "Persona roster", icon: Users },
  { to: "/agents/approvals", label: "Approvals", icon: ShieldCheck, badge: true },
  { to: "/history", label: "Beta history", icon: History },
  { to: "/pathways", label: "Pathways", icon: RouteIcon },
  { to: "/analytics", label: "Analytics", icon: BarChart3, ownerOnly: true },
  { to: "/upgrade", label: "Upgrade", icon: Crown },
  { to: "/settings", label: "Settings", icon: Settings },
];

function sectionLabel(path: string): string {
  if (path === "/") return "Dashboard";
  const match = nav.find((n) => n.to !== "/" && (path === n.to || path.startsWith(n.to + "/")));
  return match?.label ?? "Workspace";
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useAgentsVersion();
  const mounted = useMounted();
  const pending = mounted ? pendingApprovalCount() : 0;
  const section = sectionLabel(path);
  const { user, loading: authLoading, signOut } = useAuth();
  const { isOwner, active, runsRemaining, email } = useSubscription();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const visibleNav = nav.filter((n) => !n.ownerOnly || isOwner);

  return (
    <div className="relative min-h-screen text-foreground">
      {/* Decorative orbs for depth */}
      <div aria-hidden className="pointer-events-none fixed -left-32 top-10 -z-0 h-80 w-80 rounded-full bg-[color:var(--neon)] opacity-20 blur-3xl floaty" />
      <div aria-hidden className="pointer-events-none fixed right-[-6rem] top-1/3 -z-0 h-96 w-96 rounded-full bg-[color:var(--neon-2)] opacity-20 blur-3xl floaty" />

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-sidebar-border md:flex md:flex-col glass">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl btn-3d">
            <Zap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight gradient-text">Walkthrough Wizard</span>
              <span className="beta-pill">Beta</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">QAOS · v0.3</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-2">
          {visibleNav.map((n) => {
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
                  "group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all",
                  active
                    ? "bg-gradient-to-r from-[color:var(--neon)]/15 to-[color:var(--neon-2)]/15 text-foreground ring-neon"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <n.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", active && "text-[color:var(--neon)]")} />
                  {n.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="beta-pill scale-75 origin-right opacity-70">β</span>
                  {n.badge && pending > 0 && (
                    <span className="rounded-full bg-accent/30 px-1.5 text-xs font-semibold text-accent-foreground ring-1 ring-accent/50">
                      {pending}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 px-3 pb-4">
          <RunAgentDialog />
          <div className="rounded-lg border border-border/60 px-3 py-2 text-[11px] text-muted-foreground glass">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3 text-[color:var(--neon-2)]" />
              <span className="font-semibold tracking-wide">BETA TESTING</span>
            </div>
            <p className="mt-1 leading-snug">Every tab, section, and flow is under active beta. Report anything weird.</p>
          </div>
        </div>
      </aside>

      <main className="relative z-10 md:pl-64">
        {/* Sticky beta header for every page/section */}
        <div className="sticky top-0 z-10 border-b border-border/60 glass">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-2 w-2 rounded-full bg-[color:var(--neon)] pulse-dot" />
              <div className="min-w-0">
                <div className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">Walkthrough Wizard QAOS</div>
                <div className="truncate text-sm font-semibold">{section}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="beta-pill">Beta · {section}</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
