import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Activity } from "lucide-react";
import { checkAiGateway, checkEnv, checkFirecrawl } from "@/lib/qa/pathways.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/pathways")({
  head: () => ({ meta: [{ title: "Pathways · Walkthrough Wizard QAOS" }] }),
  component: PathwaysPage,
});

type CheckState = "idle" | "running" | "pass" | "fail";
type CheckResult = { state: CheckState; detail?: string; ms?: number };

const ROUTES = [
  { to: "/", label: "Dashboard" },
  { to: "/projects", label: "Projects" },
  { to: "/projects/new", label: "New project" },
  { to: "/qa", label: "QA runs" },
  { to: "/qa/new", label: "New QA crawl" },
  { to: "/agents", label: "Agents" },
  { to: "/agents/new", label: "New agent task" },
  { to: "/agents/approvals", label: "Approvals" },
  { to: "/agents/history", label: "Agent history" },
  { to: "/history", label: "Beta test history" },
  { to: "/settings", label: "Settings" },
] as const;

function PathwaysPage() {
  const ai = useServerFn(checkAiGateway);
  const fc = useServerFn(checkFirecrawl);
  const env = useServerFn(checkEnv);

  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);

  function set(id: string, r: CheckResult) {
    setResults((prev) => ({ ...prev, [id]: r }));
  }

  async function runAll() {
    setRunning(true);
    set("env", { state: "running" });
    set("ai", { state: "running" });
    set("firecrawl", { state: "running" });
    set("storage", { state: "running" });

    // localStorage
    try {
      const k = "__pathway_test";
      localStorage.setItem(k, "1");
      const ok = localStorage.getItem(k) === "1";
      localStorage.removeItem(k);
      set("storage", { state: ok ? "pass" : "fail", detail: ok ? "read/write ok" : "mismatch" });
    } catch (e) {
      set("storage", { state: "fail", detail: e instanceof Error ? e.message : String(e) });
    }

    // env
    try {
      const e = await env();
      const missing = Object.entries(e).filter(([, v]) => !v).map(([k]) => k);
      set("env", {
        state: missing.length === 0 ? "pass" : "fail",
        detail: missing.length === 0 ? "all secrets present" : `missing: ${missing.join(", ")}`,
      });
    } catch (e) {
      set("env", { state: "fail", detail: e instanceof Error ? e.message : String(e) });
    }

    // AI gateway
    try {
      const r = await ai();
      set("ai", {
        state: r.ok ? "pass" : "fail",
        detail: r.ok ? `replied "${r.reply}"` : r.error,
        ms: r.ok ? r.ms : undefined,
      });
    } catch (e) {
      set("ai", { state: "fail", detail: e instanceof Error ? e.message : String(e) });
    }

    // Firecrawl
    try {
      const r = await fc();
      set("firecrawl", {
        state: r.ok ? "pass" : "fail",
        detail: r.ok ? `mapped ${r.links} link(s)` : r.error,
        ms: r.ok ? r.ms : undefined,
      });
    } catch (e) {
      set("firecrawl", { state: "fail", detail: e instanceof Error ? e.message : String(e) });
    }

    setRunning(false);
    toast.success("Pathway checks complete");
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Beta self-test
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Deployable pathways</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify every integration and route the app needs to actually ship.
          </p>
        </div>
        <Button onClick={runAll} disabled={running}>
          {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Run all checks
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <CheckCard id="storage" title="Browser storage" desc="localStorage read/write" r={results.storage} />
        <CheckCard id="env" title="Server secrets" desc="LOVABLE_API_KEY, FIRECRAWL_API_KEY, Supabase" r={results.env} />
        <CheckCard id="ai" title="Lovable AI Gateway" desc="ping google/gemini-3-flash-preview" r={results.ai} />
        <CheckCard id="firecrawl" title="Firecrawl" desc="map a sample URL" r={results.firecrawl} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Route reachability</CardTitle>
          <CardDescription>Click any route to confirm it renders.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 sm:grid-cols-2">
            {ROUTES.map((r) => (
              <li key={r.to}>
                <Link
                  to={r.to as never}
                  className="block rounded px-2 py-1 text-sm hover:bg-accent/40"
                >
                  <span className="text-muted-foreground">{r.to}</span>{" "}
                  <span className="font-medium">{r.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function CheckCard({ id, title, desc, r }: { id: string; title: string; desc: string; r?: CheckResult }) {
  const state = r?.state ?? "idle";
  const Icon =
    state === "pass" ? CheckCircle2 :
    state === "fail" ? XCircle :
    state === "running" ? Loader2 : Activity;
  const tone =
    state === "pass" ? "text-emerald-500" :
    state === "fail" ? "text-rose-500" :
    state === "running" ? "text-sky-500" : "text-muted-foreground";
  return (
    <Card key={id}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription className="text-xs">{desc}</CardDescription>
        </div>
        <Icon className={`h-5 w-5 ${tone} ${state === "running" ? "animate-spin" : ""}`} />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className={tone}>{state}</Badge>
          {r?.ms !== undefined && <span className="text-muted-foreground">{r.ms} ms</span>}
        </div>
        {r?.detail && <p className="mt-2 text-xs text-muted-foreground break-words">{r.detail}</p>}
      </CardContent>
    </Card>
  );
}
