import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { getApp, updateApp, deleteApp } from "@/lib/apps.functions";
import { useAuth } from "@/hooks/useAuth";
import { Smartphone, Trash2, Upload, Bell, Database, Inbox } from "lucide-react";

export const Route = createFileRoute("/apps/$id")({
  head: () => ({ meta: [{ title: "App · Walkthrough Wizard QAOS" }] }),
  component: AppDetail,
});

function AppDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth", replace: true }); }, [loading, user, nav]);
  const q = useQuery({ queryKey: ["app", id], queryFn: () => getApp({ data: { id } }), enabled: !!user });
  const update = useServerFn(updateApp);
  const del = useServerFn(deleteApp);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => { if (q.data && !form) setForm(q.data); }, [q.data, form]);

  if (loading || !user || !q.data || !form) return null;

  const save = async () => {
    setSaving(true);
    await update({ data: { id, patch: { name: form.name, base_url: form.base_url, short_desc: form.short_desc, long_desc: form.long_desc, theme_color: form.theme_color, category: form.category, status: form.status } } });
    setSaving(false);
    q.refetch();
  };
  const remove = async () => {
    if (!confirm("Delete this app? This removes all submissions, data, campaigns.")) return;
    await del({ data: { id } });
    nav({ to: "/apps", replace: true });
  };

  return (
    <AppShell>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ background: form.theme_color }}>
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{form.name}</h1>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{form.status}</div>
          </div>
        </div>
        <button onClick={remove} className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 inline-flex items-center gap-1">
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Link to="/apps/$id/submit" params={{ id }} className="rounded-lg border border-border bg-card p-4 hover:border-fuchsia-400">
          <Upload className="h-5 w-5 text-fuchsia-400" />
          <div className="mt-2 font-semibold text-sm">Submit to stores</div>
          <div className="text-[11px] text-muted-foreground">PWA · Apple · Google Play</div>
        </Link>
        <Link to="/notifications" className="rounded-lg border border-border bg-card p-4 hover:border-fuchsia-400">
          <Bell className="h-5 w-5 text-fuchsia-400" />
          <div className="mt-2 font-semibold text-sm">Push notifications</div>
        </Link>
        <Link to="/data" className="rounded-lg border border-border bg-card p-4 hover:border-fuchsia-400">
          <Database className="h-5 w-5 text-fuchsia-400" />
          <div className="mt-2 font-semibold text-sm">Data manager</div>
        </Link>
        <Link to="/submissions" className="rounded-lg border border-border bg-card p-4 hover:border-fuchsia-400">
          <Inbox className="h-5 w-5 text-fuchsia-400" />
          <div className="mt-2 font-semibold text-sm">Form submissions</div>
        </Link>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">App details</h2>
        <F label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></F>
        <F label="Base URL"><input value={form.base_url ?? ""} onChange={(e) => setForm({ ...form, base_url: e.target.value })} className="input" /></F>
        <F label="Short description"><input value={form.short_desc ?? ""} onChange={(e) => setForm({ ...form, short_desc: e.target.value })} maxLength={80} className="input" /></F>
        <F label="Long description"><textarea value={form.long_desc ?? ""} onChange={(e) => setForm({ ...form, long_desc: e.target.value })} rows={4} maxLength={4000} className="input" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Theme color"><input type="color" value={form.theme_color ?? "#7c3aed"} onChange={(e) => setForm({ ...form, theme_color: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background" /></F>
          <F label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
              <option value="draft">Draft</option><option value="pwa_ready">PWA ready</option>
              <option value="submitted">Submitted</option><option value="published">Published</option>
            </select>
          </F>
        </div>
        <button onClick={save} disabled={saving} className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <style>{`.input{width:100%;border-radius:.375rem;border:1px solid hsl(var(--input));background:hsl(var(--background));padding:.5rem .75rem;font-size:.875rem}`}</style>
    </AppShell>
  );
}

function F({ label, children }: any) {
  return <label className="block space-y-1"><span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>{children}</label>;
}
