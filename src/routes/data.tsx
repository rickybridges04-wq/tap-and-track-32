import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { TrashButton } from "@/components/TrashButton";
import { listApps, listAppTables, createAppTable, listAppRows, insertAppRow, deleteAppTable, deleteAppRow } from "@/lib/apps.functions";
import { useAuth } from "@/hooks/useAuth";
import { Database, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/data")({
  head: () => ({ meta: [{ title: "Data Manager · Walkthrough Wizard QAOS" }] }),
  component: DataManager,
});

function DataManager() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth", replace: true }); }, [loading, user, nav]);
  const appsQ = useQuery({ queryKey: ["apps"], queryFn: () => listApps(), enabled: !!user });
  const tablesQ = useQuery({ queryKey: ["app_tables"], queryFn: () => listAppTables(), enabled: !!user });
  const createT = useServerFn(createAppTable);
  const insertR = useServerFn(insertAppRow);
  const [sel, setSel] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCols, setNewCols] = useState("name,email");
  const [newApp, setNewApp] = useState("");

  const rowsQ = useQuery({ queryKey: ["rows", sel], queryFn: () => listAppRows({ data: { tableId: sel! } }), enabled: !!sel });

  if (loading || !user) return null;
  const apps = (appsQ.data ?? []) as any[];
  const tables = (tablesQ.data ?? []) as any[];
  const table = tables.find((t) => t.id === sel);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = newCols.split(",").map((c) => ({ name: c.trim(), type: "text" }));
    const t = await createT({ data: { app_id: newApp, name: newName, schema } });
    setShowNew(false); setNewName(""); setNewCols("name,email");
    tablesQ.refetch(); setSel((t as any).id);
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Data Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your app's data, databases, and content.</p>
        </div>
        <button onClick={() => { setShowNew(true); if (apps[0]) setNewApp(apps[0].id); }} disabled={!apps.length} className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> New table
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3">
          <select value={newApp} onChange={(e) => setNewApp(e.target.value)} className="input">
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Table name (e.g. contacts)" className="input" />
          <input value={newCols} onChange={(e) => setNewCols(e.target.value)} placeholder="Columns (comma-separated)" className="input" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowNew(false)} className="rounded-md border border-border px-3 py-1.5 text-xs">Cancel</button>
            <button className="rounded-lg bg-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white">Create</button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-[240px,1fr]">
        <div className="rounded-lg border border-border bg-card p-2 space-y-1">
          {tables.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground"><Database className="mx-auto h-6 w-6" /><p className="mt-2">No tables yet.</p></div>
          )}
          {tables.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${sel === t.id ? "bg-fuchsia-500/20 text-fuchsia-300" : "hover:bg-muted"}`}>
              <div className="font-semibold">{t.name}</div>
              <div className="text-[11px] text-muted-foreground">{t.apps?.name}</div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          {!table && <p className="text-sm text-muted-foreground">Select a table.</p>}
          {table && <TableView table={table} rows={rowsQ.data ?? []} onInsert={async (data: Record<string, unknown>) => { await insertR({ data: { table_id: table.id, data } }); rowsQ.refetch(); }} />}
        </div>
      </div>
      <style>{`.input{width:100%;border-radius:.375rem;border:1px solid hsl(var(--input));background:hsl(var(--background));padding:.5rem .75rem;font-size:.875rem}`}</style>
    </AppShell>
  );
}

function TableView({ table, rows, onInsert }: any) {
  const cols = (table.schema as any[]) ?? [];
  const [form, setForm] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => { e.preventDefault(); await onInsert(form); setForm({}); };
  return (
    <div>
      <div className="font-semibold">{table.name}</div>
      <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
        {cols.map((c: any) => (
          <input key={c.name} value={form[c.name] ?? ""} onChange={(e) => setForm({ ...form, [c.name]: e.target.value })} placeholder={c.name} className="flex-1 min-w-[120px] rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
        ))}
        <button className="rounded-md bg-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white">Add</button>
      </form>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>{cols.map((c: any) => <th key={c.name} className="px-2 py-1">{c.name}</th>)}<th className="px-2 py-1">Created</th></tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                {cols.map((c: any) => <td key={c.name} className="px-2 py-1">{r.data[c.name] ?? ""}</td>)}
                <td className="px-2 py-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-2 py-4 text-center text-xs text-muted-foreground">No rows.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
