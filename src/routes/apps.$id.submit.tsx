import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { getApp, getSubmissions, upsertSubmission } from "@/lib/apps.functions";
import { useAuth } from "@/hooks/useAuth";
import { Check, ChevronRight, Download } from "lucide-react";

export const Route = createFileRoute("/apps/$id/submit")({
  head: () => ({ meta: [{ title: "Submit app · Walkthrough Wizard QAOS" }] }),
  component: SubmitWizard,
});

const CHECKLISTS = {
  pwa: [
    { key: "manifest", label: "Web app manifest present" },
    { key: "icon192", label: "192×192 icon" },
    { key: "icon512", label: "512×512 icon" },
    { key: "apple_touch", label: "Apple touch icon (180×180)" },
    { key: "service_worker", label: "Service worker registered" },
    { key: "https", label: "Served over HTTPS" },
    { key: "responsive", label: "Responsive on mobile viewport" },
  ],
  apple: [
    { key: "icon1024", label: "1024×1024 app icon (no alpha)" },
    { key: "screenshots_67", label: '6.7" screenshots (1290×2796) — min 3' },
    { key: "screenshots_65", label: '6.5" screenshots (1284×2778)' },
    { key: "screenshots_55", label: '5.5" screenshots (1242×2208)' },
    { key: "privacy_url", label: "Privacy policy URL" },
    { key: "support_url", label: "Support URL" },
    { key: "description", label: "Description ≤ 4000 chars" },
    { key: "keywords", label: "Keywords ≤ 100 chars" },
    { key: "age_rating", label: "Age rating set" },
    { key: "guideline_42", label: "Passes 4.2 minimum-functionality (verified by QA run)" },
  ],
  google: [
    { key: "icon512", label: "512×512 hi-res icon" },
    { key: "feature_graphic", label: "1024×500 feature graphic" },
    { key: "screenshots", label: "Phone screenshots (min 2, max 8)" },
    { key: "short_desc", label: "Short description ≤ 80 chars" },
    { key: "full_desc", label: "Full description ≤ 4000 chars" },
    { key: "content_rating", label: "Content rating questionnaire done" },
    { key: "data_safety", label: "Data safety form filled" },
    { key: "target_api", label: "Target API level 34+" },
    { key: "privacy_url", label: "Privacy policy URL" },
  ],
} as const;

const STEPS = ["Select app", "PWA", "Apple App Store", "Google Play"] as const;

function SubmitWizard() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth", replace: true }); }, [loading, user, nav]);
  const [step, setStep] = useState(1);
  const appQ = useQuery({ queryKey: ["app", id], queryFn: () => getApp({ data: { id } }), enabled: !!user });
  const subsQ = useQuery({ queryKey: ["subs", id], queryFn: () => getSubmissions({ data: { appId: id } }), enabled: !!user });
  const save = useServerFn(upsertSubmission);

  if (loading || !user || !appQ.data) return null;
  const app = appQ.data as any;
  const submissions = (subsQ.data ?? []) as any[];
  const stores: ("pwa" | "apple" | "google")[] = ["pwa", "apple", "google"];
  const store = stores[step - 2];

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Submit "{app.name}" to stores</h1>
      <p className="mt-1 text-sm text-muted-foreground">Submit your app to multiple platforms: PWA, Apple App Store, Google Play Store</p>

      <div className="mt-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button onClick={() => setStep(i + 1)} className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${step === i + 1 ? "bg-fuchsia-500 text-white" : step > i + 1 ? "bg-fuchsia-500/30 text-fuchsia-300" : "bg-muted text-muted-foreground"}`}>
              {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>
      <div className="mt-2 text-sm font-semibold">{STEPS[step - 1]} <span className="text-muted-foreground">({step}/{STEPS.length})</span></div>

      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        {step === 1 && <Step1 app={app} onNext={() => setStep(2)} />}
        {step > 1 && (
          <ChecklistStep
            store={store}
            existing={submissions.find((s) => s.store === store)}
            onSave={async (checklist, status) => {
              await save({ data: { appId: id, store, checklist, status } });
              subsQ.refetch();
              if (step < 4) setStep(step + 1);
            }}
            onBack={() => setStep(step - 1)}
          />
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <Link to="/apps/$id" params={{ id }} className="text-xs text-muted-foreground hover:underline">← Back to app</Link>
        {submissions.length > 0 && (
          <button onClick={() => downloadPacket(app, submissions)} className="text-xs text-fuchsia-400 hover:underline inline-flex items-center gap-1">
            <Download className="h-3 w-3" /> Download submission packet (JSON)
          </button>
        )}
      </div>
    </AppShell>
  );
}

function Step1({ app, onNext }: any) {
  return (
    <div>
      <h2 className="font-semibold">Select app</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose which app you'd like to submit.</p>
      <div className="mt-4 rounded-md border border-border p-4">
        <div className="font-semibold">{app.name}</div>
        <div className="text-xs text-muted-foreground">{app.base_url ?? "no URL set"} · {app.category ?? "uncategorized"}</div>
      </div>
      <button onClick={onNext} className="mt-6 rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white">Continue</button>
    </div>
  );
}

function ChecklistStep({ store, existing, onSave, onBack }: { store: "pwa" | "apple" | "google"; existing: any; onSave: (c: any, s: string) => void; onBack: () => void }) {
  const items = CHECKLISTS[store];
  const [checked, setChecked] = useState<Record<string, boolean>>(existing?.checklist ?? {});
  const done = useMemo(() => items.filter((i) => checked[i.key]).length, [items, checked]);
  const pct = Math.round((done / items.length) * 100);
  const complete = done === items.length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{store === "pwa" ? "PWA readiness" : store === "apple" ? "Apple App Store" : "Google Play Store"}</h2>
        <span className="text-xs text-muted-foreground">{done}/{items.length} · {pct}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 space-y-2">
        {items.map((i) => (
          <label key={i.key} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 hover:bg-muted/30 cursor-pointer">
            <input type="checkbox" checked={!!checked[i.key]} onChange={(e) => setChecked({ ...checked, [i.key]: e.target.checked })} className="h-4 w-4" />
            <span className="text-sm">{i.label}</span>
          </label>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        <button onClick={onBack} className="rounded-md border border-border px-4 py-2 text-sm">Back</button>
        <button onClick={() => onSave(checked, complete ? "ready" : "in_progress")} className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white">
          {complete ? "Mark ready & continue" : "Save & continue"}
        </button>
      </div>
    </div>
  );
}

function downloadPacket(app: any, submissions: any[]) {
  const packet = { app: { name: app.name, base_url: app.base_url, short_desc: app.short_desc, long_desc: app.long_desc, category: app.category }, submissions };
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${app.name.replace(/\s+/g, "-")}-submission.json`; a.click();
  URL.revokeObjectURL(url);
}
