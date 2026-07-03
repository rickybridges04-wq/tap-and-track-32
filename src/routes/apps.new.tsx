import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { createApp } from "@/lib/apps.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/apps/new")({
  head: () => ({ meta: [{ title: "New app · Walkthrough Wizard QAOS" }] }),
  component: NewApp,
});

const CATEGORIES = ["Productivity", "Utility", "Social", "Business", "Education", "Entertainment", "Games", "Health & Fitness", "Finance", "Other"];

function NewApp() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const create = useServerFn(createApp);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("Productivity");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (loading) return null;
  if (!user) { nav({ to: "/auth", replace: true }); return null; }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const app = await create({ data: { name, base_url: url || undefined, short_desc: desc || undefined, category: cat } });
      nav({ to: "/apps/$id", params: { id: (app as any).id } });
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">New app</h1>
      <p className="mt-1 text-sm text-muted-foreground">Register an app to prep it as a PWA and submit it to stores.</p>

      <form onSubmit={submit} className="mt-6 max-w-xl space-y-4 rounded-lg border border-border bg-card p-6">
        <Field label="App name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="My awesome app" />
        </Field>
        <Field label="Base URL">
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="https://myapp.com" />
        </Field>
        <Field label="Short description">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={80} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="One-line pitch (max 80 chars)" />
          <div className="text-[11px] text-muted-foreground">{desc.length}/80</div>
        </Field>
        <Field label="Category">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        {err && <div className="rounded-md bg-red-500/10 p-2 text-xs text-red-400">{err}</div>}
        <button disabled={busy} className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Creating..." : "Create app"}
        </button>
      </form>
    </AppShell>
  );
}

function Field({ label, required, children }: any) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}{required && " *"}</span>
      {children}
    </label>
  );
}
