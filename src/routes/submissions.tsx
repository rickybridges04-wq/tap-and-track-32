import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { listFormSubmissions, markSubmissionRead } from "@/lib/apps.functions";
import { useAuth } from "@/hooks/useAuth";
import { Inbox, Copy } from "lucide-react";

export const Route = createFileRoute("/submissions")({
  head: () => ({ meta: [{ title: "Submissions · Walkthrough Wizard QAOS" }] }),
  component: Submissions,
});

function Submissions() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth", replace: true }); }, [loading, user, nav]);
  const q = useQuery({ queryKey: ["form_subs"], queryFn: () => listFormSubmissions(), enabled: !!user });
  const mark = useServerFn(markSubmissionRead);
  if (loading || !user) return null;
  const subs = (q.data ?? []) as any[];
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Submissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">View and manage form submissions and user data.</p>

      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Public endpoint (POST JSON)</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-2 py-1 text-xs font-mono">{origin}/api/public/forms/[appId]/[formName]</code>
          <button onClick={() => navigator.clipboard.writeText(`${origin}/api/public/forms/[appId]/[formName]`)} className="rounded-md border border-border p-1.5 hover:bg-muted"><Copy className="h-3 w-3" /></button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">POST any JSON body. Replace [appId] with your app's ID and [formName] with any label.</p>
      </div>

      {subs.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No submissions yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {subs.map((s) => (
            <div key={s.id} className={`rounded-lg border p-4 ${s.read_at ? "border-border bg-card" : "border-fuchsia-500/40 bg-fuchsia-500/5"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold">{s.form_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{s.apps?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  {!s.read_at && <button onClick={async () => { await mark({ data: { id: s.id } }); q.refetch(); }} className="rounded bg-fuchsia-500 px-2 py-0.5 text-white">Mark read</button>}
                </div>
              </div>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">{JSON.stringify(s.payload, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
