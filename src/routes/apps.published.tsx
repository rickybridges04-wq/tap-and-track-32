import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listApps } from "@/lib/apps.functions";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Globe } from "lucide-react";

export const Route = createFileRoute("/apps/published")({
  head: () => ({ meta: [{ title: "Published apps · Walkthrough Wizard QAOS" }] }),
  component: Published,
});

function Published() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth", replace: true }); }, [loading, user, nav]);
  const q = useQuery({ queryKey: ["apps"], queryFn: () => listApps(), enabled: !!user });
  if (loading || !user) return null;

  const published = (q.data ?? []).filter((a: any) => a.status === "published");

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Published Apps</h1>
      <p className="mt-1 text-sm text-muted-foreground">Apps you've submitted and marked as published.</p>

      {published.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center">
          <Globe className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No Published Apps</h2>
          <p className="mt-1 text-sm text-muted-foreground">You haven't published any apps yet. Submit an app to the app stores to see it here.</p>
          <Link to="/apps" className="mt-4 inline-block rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white">Submit Your First App</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {published.map((a: any) => (
            <Link key={a.id} to="/apps/$id" params={{ id: a.id }} className="rounded-lg border border-border bg-card p-4 hover:border-fuchsia-400">
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.base_url}</div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
