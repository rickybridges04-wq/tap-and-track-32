import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getLastDiag, installDiagGlobals, recordDiag, type DiagEntry } from "@/lib/diag";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({ meta: [{ title: "Developer diagnostics" }] }),
  component: DiagnosticsPage,
});

const PROBE_TABLES = ["apps", "profiles", "user_roles", "qa_runs", "app_store_submissions"] as const;

type Probe = { table: string; ok: boolean; count?: number | null; error?: DiagEntry };

function DiagnosticsPage() {
  const { user, session, loading } = useAuth();
  const [roles, setRoles] = useState<string[] | null>(null);
  const [rolesErr, setRolesErr] = useState<string | null>(null);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [lastErr, setLastErr] = useState<DiagEntry | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    installDiagGlobals();
    setLastErr(getLastDiag());
    const handler = (e: Event) => setLastErr((e as CustomEvent).detail);
    window.addEventListener("bridges:diag", handler);
    return () => window.removeEventListener("bridges:diag", handler);
  }, []);

  async function runChecks() {
    if (!user) return;
    setRunning(true);
    setRoles(null);
    setRolesErr(null);
    setProbes([]);

    const { data: r, error: rErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rErr) {
      setRolesErr(rErr.message);
      recordDiag(rErr, { functionName: "user_roles.select" });
    } else {
      setRoles((r ?? []).map((x: any) => x.role));
    }

    const results: Probe[] = [];
    for (const t of PROBE_TABLES) {
      const { count, error } = await supabase
        .from(t as any)
        .select("*", { count: "exact", head: true });
      if (error) {
        const entry = recordDiag(error, { functionName: `${t}.head` })!;
        results.push({ table: t, ok: false, error: entry });
      } else {
        results.push({ table: t, ok: true, count });
      }
    }
    setProbes(results);
    setRunning(false);
  }

  useEffect(() => {
    if (!loading && user) runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 text-sm">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Developer diagnostics</h1>
          <p className="text-muted-foreground">Current session, RLS reachability, and the last captured backend error.</p>
        </div>
        <button
          onClick={runChecks}
          disabled={running || !user}
          className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
        >
          {running ? "Running…" : "Re-run checks"}
        </button>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Current user</h2>
        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : user ? (
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">user id</dt><dd>{user.id}</dd>
            <dt className="text-muted-foreground">email</dt><dd>{user.email ?? "—"}</dd>
            <dt className="text-muted-foreground">provider</dt><dd>{user.app_metadata?.provider ?? "—"}</dd>
            <dt className="text-muted-foreground">expires</dt><dd>{session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : "—"}</dd>
            <dt className="text-muted-foreground">roles</dt>
            <dd>{rolesErr ? <span className="text-red-500">{rolesErr}</span> : roles ? (roles.join(", ") || "(none)") : "…"}</dd>
          </dl>
        ) : (
          <div className="text-red-500">No authenticated user. Sign in first.</div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">RLS reachability (as current user)</h2>
        <table className="w-full font-mono text-xs">
          <thead className="text-muted-foreground">
            <tr><th className="text-left">Table</th><th className="text-left">Status</th><th className="text-left">Rows visible</th><th className="text-left">Error</th></tr>
          </thead>
          <tbody>
            {probes.map((p) => (
              <tr key={p.table} className="border-t border-border/50">
                <td className="py-1">{p.table}</td>
                <td className={p.ok ? "text-green-500" : "text-red-500"}>{p.ok ? "OK" : "DENIED"}</td>
                <td>{p.count ?? "—"}</td>
                <td className="text-red-500">{p.error?.message ?? ""}{p.error?.hint ? ` — hint: ${p.error.hint}` : ""}</td>
              </tr>
            ))}
            {probes.length === 0 && <tr><td colSpan={4} className="py-2 text-muted-foreground">No probes yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Last captured backend error</h2>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { try { sessionStorage.removeItem("__bridges_last_diag_error"); } catch {}; (window as any).__bridges_last_diag_error = undefined; setLastErr(null); }}
          >Clear</button>
        </div>
        {lastErr ? (
          <pre className="overflow-auto rounded bg-muted p-3 font-mono text-xs">{JSON.stringify(lastErr, null, 2)}</pre>
        ) : (
          <div className="text-muted-foreground">No error captured this session.</div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Errors are captured automatically for RLS/permission/policy/JWT failures and any call that uses <code>recordDiag()</code>.</p>
      </section>
    </div>
  );
}
