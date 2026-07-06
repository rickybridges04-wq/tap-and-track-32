import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProjects, listRuns, useStoreVersion } from "@/lib/store";
import { useMounted } from "@/lib/agent-store";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, CheckCircle2, XCircle, AlertTriangle, ExternalLink,
  Zap, Sparkles, Bot, ShieldCheck, Search, Loader2, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Walkthrough Wizard QAOS — Autonomous QA for web apps" },
      { name: "description", content: "Crawl, inspect, score, and fix any web app. Walkthrough Wizard runs autonomous QA + AI agent operations so you ship with confidence." },
      { property: "og:title", content: "Walkthrough Wizard QAOS — Autonomous QA for web apps" },
      { property: "og:description", content: "Crawl, inspect, score, and fix. Autonomous QA + AI agent operations for web apps." },
      { property: "og:url", content: "https://tap-and-track-32.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://tap-and-track-32.lovable.app/" }],
  }),
  component: Home,
});

function Home() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return user ? <Dashboard /> : <Landing />;
}

/* ---------------- Public landing ---------------- */

function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-fuchsia-500 opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute right-[-6rem] top-1/3 h-96 w-96 rounded-full bg-cyan-500 opacity-20 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Walkthrough Wizard QAOS home" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-white shadow-lg shadow-fuchsia-500/30">
            <Zap className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold tracking-tight">Walkthrough Wizard QAOS</span>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Beta</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-foreground/90 hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-90"
          >
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
            <Sparkles className="h-3 w-3" /> Beta · 3 free runs
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Autonomous QA for any{" "}
            <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              web app
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-foreground/80">
            Point Walkthrough Wizard at your app's URL. It crawls every page,
            walks the flows as real personas, scores your release readiness,
            and writes a fix list you can hand straight to your dev agent.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-90"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-base font-medium text-foreground hover:bg-accent"
            >
              How it works
            </a>
          </div>
          <p className="mt-3 text-sm text-foreground/70">
            No credit card. 3 full QA / agent runs on the house.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
        <p className="mt-2 max-w-2xl text-foreground/70">
          A "run" is one full pass: your app is crawled, walked, scored, and
          returned with a prioritized fix list. Each free-tier account gets 3.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step icon={Search} n={1} title="Crawl" body="We map every reachable page from your base URL." />
          <Step icon={Bot} n={2} title="Walk" body="AI personas complete real user flows end-to-end." />
          <Step icon={ShieldCheck} n={3} title="Score" body="Get a release-readiness score across UX, a11y, and copy." />
          <Step icon={Sparkles} n={4} title="Fix" body="Export a ranked fix list you can paste into any dev agent." />
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur sm:p-8">
          <h3 className="text-lg font-semibold">Ready to see your app's score?</h3>
          <p className="mt-1 text-sm text-foreground/70">Create an account and run your first walkthrough in under 2 minutes.</p>
          <Link
            to="/auth"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-90"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/60 py-6 text-center text-xs text-foreground/60">
        © {new Date().getFullYear()} Bridges AI Enterprises · Walkthrough Wizard QAOS
      </footer>
    </div>
  );
}

function Step({ icon: Icon, n, title, body }: { icon: typeof Zap; n: number; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
        <Icon className="h-4 w-4" /> Step {n}
      </div>
      <div className="mt-2 text-base font-semibold">{title}</div>
      <p className="mt-1 text-sm text-foreground/70">{body}</p>
    </div>
  );
}

/* ---------------- Authed dashboard (unchanged behavior) ---------------- */

function Dashboard() {
  useStoreVersion();
  const mounted = useMounted();
  const projects = mounted ? listProjects() : [];
  const runs = mounted ? listRuns() : [];

  const stats = useMemo(() => {
    const last = runs.slice(0, 50);
    const pass = last.reduce((a, r) => a + r.stats.pass, 0);
    const fail = last.reduce((a, r) => a + r.stats.fail, 0);
    const warn = last.reduce((a, r) => a + r.stats.warn, 0);
    return { pass, fail, warn, runs: runs.length };
  }, [runs]);

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All your apps, their latest runs, and outstanding issues.
          </p>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="mr-1 h-4 w-4" /> New project
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Total runs" value={stats.runs} />
        <StatCard label="Passing steps" value={stats.pass} tone="good" />
        <StatCard label="Failing steps" value={stats.fail} tone="bad" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Apps registered for testing.</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                body="Add the public URL of your app to run your first usability walkthrough."
                action={
                  <Button asChild>
                    <Link to="/projects/new">
                      <Plus className="mr-1 h-4 w-4" /> Add project
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {projects.map((p) => {
                  const last = runs.find((r) => r.projectId === p.id);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <Link
                          to="/projects/$id"
                          params={{ id: p.id }}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {p.name}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">{p.baseUrl}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {last ? <RunBadge stats={last.stats} /> : <Badge variant="outline">No runs</Badge>}
                        <Button asChild size="sm" variant="outline">
                          <Link to="/projects/$id" params={{ id: p.id }}>Open</Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent runs</CardTitle>
            <CardDescription>Latest 10 walkthroughs.</CardDescription>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              <ul className="space-y-2">
                {runs.slice(0, 10).map((r) => {
                  const proj = projects.find((p) => p.id === r.projectId);
                  return (
                    <li key={r.id}>
                      <Link
                        to="/runs/$id"
                        params={{ id: r.id }}
                        className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{proj?.name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(r.startedAt).toLocaleString()}
                          </div>
                        </div>
                        <RunBadge stats={r.stats} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Heads up — base build</CardTitle>
          <CardDescription>
            Runs are simulated until Lovable Cloud + Browserbase are connected.
            See <Link to="/settings" className="underline">Settings</Link> for the exact secrets and links you'll need.
            <ExternalLink className="ml-1 inline h-3 w-3" />
          </CardDescription>
        </CardHeader>
      </Card>
    </AppShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div
          className={
            "mt-1 text-2xl font-semibold " +
            (tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-destructive" : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function RunBadge({ stats }: { stats: { pass: number; fail: number; warn: number } }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {stats.pass}
      </span>
      <span className="inline-flex items-center gap-1 text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        {stats.warn}
      </span>
      <span className="inline-flex items-center gap-1 text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        {stats.fail}
      </span>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
