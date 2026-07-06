import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { TrashButton } from "@/components/TrashButton";
import { listApps, listCampaigns, createCampaign, listSubscribers, deleteCampaign } from "@/lib/apps.functions";
import { useAuth } from "@/hooks/useAuth";
import { Bell, Send, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Push notifications · Walkthrough Wizard QAOS" }] }),
  component: Notifications,
});

function Notifications() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth", replace: true }); }, [loading, user, nav]);
  const [tab, setTab] = useState<"create" | "scheduled" | "history">("create");
  const appsQ = useQuery({ queryKey: ["apps"], queryFn: () => listApps(), enabled: !!user });
  const campsQ = useQuery({ queryKey: ["campaigns"], queryFn: () => listCampaigns(), enabled: !!user });
  const create = useServerFn(createCampaign);

  const [appId, setAppId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  const subsQ = useQuery({ queryKey: ["subs", appId], queryFn: () => listSubscribers({ data: { appId } }), enabled: !!appId });

  useEffect(() => {
    if (appsQ.data && appsQ.data.length && !appId) setAppId((appsQ.data[0] as any).id);
  }, [appsQ.data, appId]);

  if (loading || !user) return null;
  const apps = (appsQ.data ?? []) as any[];
  const camps = (campsQ.data ?? []) as any[];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await create({ data: { app_id: appId, title, body, url: url || undefined, scheduled_for: when || null } });
    setTitle(""); setBody(""); setUrl(""); setWhen("");
    setBusy(false);
    campsQ.refetch();
    setTab("history");
  };

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Push Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">Send targeted notifications to your app users.</p>

      {apps.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Create an app first to send notifications.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Notifications sent" value={camps.filter((c) => c.sent_at).length} icon={<Send className="h-4 w-4" />} />
            <Stat label="Subscribers" value={subsQ.data?.length ?? 0} icon={<Bell className="h-4 w-4" />} />
            <Stat label="Scheduled" value={camps.filter((c) => c.status === "scheduled").length} icon={<Clock className="h-4 w-4" />} />
          </div>

          <div className="mt-6 flex gap-1 border-b border-border">
            {(["create", "scheduled", "history"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm ${tab === t ? "border-b-2 border-fuchsia-500 font-semibold" : "text-muted-foreground"}`}>
                {t === "create" ? "Create Notification" : t === "scheduled" ? "Scheduled" : "Campaign History"}
              </button>
            ))}
          </div>

          {tab === "create" && (
            <form onSubmit={send} className="mt-6 max-w-xl space-y-4 rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Send Push Notification</h2>
              <F label="Sending From">
                <select value={appId} onChange={(e) => setAppId(e.target.value)} className="input">
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </F>
              <F label="Notification Title"><input value={title} onChange={(e) => setTitle(e.target.value)} required className="input" placeholder="Enter notification title..." /></F>
              <F label="Message"><textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} className="input" placeholder="Enter your notification message..." /></F>
              <F label="Click URL (optional)"><input value={url} onChange={(e) => setUrl(e.target.value)} type="url" className="input" placeholder="https://..." /></F>
              <F label="Schedule for (optional)"><input value={when} onChange={(e) => setWhen(e.target.value)} type="datetime-local" className="input" /></F>
              <button disabled={busy} className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? "Saving..." : when ? "Schedule notification" : "Save draft"}
              </button>
              <p className="text-[11px] text-muted-foreground">Web-push delivery requires VAPID keys; once configured, campaigns dispatch to subscribers via a background job.</p>
            </form>
          )}

          {tab === "scheduled" && <CampList camps={camps.filter((c) => c.status === "scheduled")} onDeleted={() => campsQ.refetch()} />}
          {tab === "history" && <CampList camps={camps.filter((c) => c.status !== "scheduled")} onDeleted={() => campsQ.refetch()} />}
        </>
      )}
      <style>{`.input{width:100%;border-radius:.375rem;border:1px solid hsl(var(--input));background:hsl(var(--background));padding:.5rem .75rem;font-size:.875rem}`}</style>
    </AppShell>
  );
}

function Stat({ label, value, icon }: any) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
function CampList({ camps, onDeleted }: { camps: any[]; onDeleted: () => void }) {
  const del = useServerFn(deleteCampaign);
  if (camps.length === 0) return <p className="mt-6 text-sm text-muted-foreground">No campaigns.</p>;
  return (
    <div className="mt-6 space-y-2">
      {camps.map((c) => (
        <div key={c.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.apps?.name} · {c.status}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">{c.scheduled_for ? new Date(c.scheduled_for).toLocaleString() : new Date(c.created_at).toLocaleDateString()}</div>
              <TrashButton
                label="Delete campaign"
                confirm={`Delete campaign "${c.title}"?`}
                onDelete={async () => { try { await del({ data: { id: c.id } }); toast.success("Deleted"); onDeleted(); } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); } }}
              />
            </div>
          </div>
          <p className="mt-2 text-sm">{c.body}</p>
        </div>
      ))}
    </div>
  );
}
function F({ label, children }: any) {
  return <label className="block space-y-1"><span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>{children}</label>;
}
