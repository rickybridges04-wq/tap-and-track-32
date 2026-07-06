import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { TrashButton } from "@/components/TrashButton";
import { listApps, syncAppFromCrawl, deleteApp } from "@/lib/apps.functions";
import { Smartphone, Plus, ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/apps/")({
  head: () => ({ meta: [{ title: "My Apps · Walkthrough Wizard QAOS" }] }),
  component: AppsIndex,
});

function AppsIndex() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth", replace: true }); }, [loading, user, nav]);
  const q = useQuery({ queryKey: ["apps"], queryFn: () => listApps(), enabled: !!user });
  const sync = useServerFn(syncAppFromCrawl);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const del = useServerFn(deleteApp);

  const doSync = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    setSyncingId(id);
    try { await sync({ data: { id } }); await q.refetch(); } catch {} finally { setSyncingId(null); }
  };

  const doDelete = async (id: string) => {
    try { await del({ data: { id } }); toast.success("App deleted"); await q.refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  };




  if (loading || !user) return null;
  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Apps</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register your apps, prep them for stores, ship push, collect submissions.</p>
        </div>
        <Link to="/apps/new" className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-600 inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New app
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((a: any) => (
          <Link key={a.id} to="/apps/$id" params={{ id: a.id }} className="rounded-lg border border-border bg-card p-4 hover:border-fuchsia-400 transition">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: a.theme_color ?? "#7c3aed" }}>
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-center gap-1">
                {a.base_url && (
                  <button onClick={(e) => doSync(e, a.id)} disabled={syncingId === a.id} title="Sync from URL" className="rounded-md p-1 text-fuchsia-400 hover:bg-fuchsia-500/10 disabled:opacity-50">
                    <RefreshCw className={`h-3.5 w-3.5 ${syncingId === a.id ? "animate-spin" : ""}`} />
                  </button>
                )}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{a.status}</span>
                <TrashButton
                  label={`Delete ${a.name}`}
                  confirm={`Delete "${a.name}" and all its data? This cannot be undone.`}
                  onDelete={() => doDelete(a.id)}
                />
              </div>
            </div>
            <div className="mt-3 font-semibold">{a.name}</div>
            {a.short_desc && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.short_desc}</div>}
            {a.base_url && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-fuchsia-400">
                <ExternalLink className="h-3 w-3" /> {a.base_url.replace(/^https?:\/\//, "").slice(0, 30)}
              </div>
            )}
          </Link>
        ))}
        {q.data && q.data.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center">
            <Smartphone className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No apps yet. Register your first one.</p>
            <Link to="/apps/new" className="mt-4 inline-block rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white">Create app</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
