import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/lib/subscription";
import { getAnalytics } from "@/lib/analytics.functions";
import { BarChart3, Users, DollarSign, Activity, Lock } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Walkthrough Wizard QAOS" }] }),
  component: Analytics,
});

function Analytics() {
  const { user, loading } = useAuth();
  const { isOwner, loading: subLoading } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const q = useQuery({
    queryKey: ["analytics"],
    queryFn: () => getAnalytics(),
    enabled: !!user && isOwner,
  });

  if (loading || subLoading || !user) return null;

  if (!isOwner) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Owner only</h2>
          <p className="mt-1 text-sm text-muted-foreground">The analytics dashboard is available to the workspace owner.</p>
          <Link to="/" className="mt-4 inline-block text-xs text-fuchsia-400 hover:underline">Back to dashboard</Link>
        </div>
      </AppShell>
    );
  }

  const d = q.data;

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">Owner-only overview of users, usage, and revenue.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Users className="h-4 w-4" />} label="Total signups" value={d?.totalUsers ?? "–"} />
        <Stat icon={<Activity className="h-4 w-4" />} label="Active subscribers" value={d?.activeSubs ?? "–"} />
        <Stat icon={<DollarSign className="h-4 w-4" />} label="MRR" value={d ? `$${d.mrr.toFixed(2)}` : "–"} />
        <Stat icon={<BarChart3 className="h-4 w-4" />} label="Total runs (30d)" value={d?.runsLast30d ?? "–"} />
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Signed up</th>
                <th className="px-4 py-2">Runs</th>
                <th className="px-4 py-2">Plan</th>
              </tr>
            </thead>
            <tbody>
              {(d?.users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{u.runs}</td>
                  <td className="px-4 py-2">
                    {u.plan === "pro" ? (
                      <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-xs text-fuchsia-300">Pro</span>
                    ) : u.plan === "owner" ? (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Owner</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Free</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!d || d.users.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  {q.isLoading ? "Loading..." : "No users yet"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
