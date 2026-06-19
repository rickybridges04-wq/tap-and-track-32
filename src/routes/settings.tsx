import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, KeyRound, Cloud, Globe, Bot } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Bridges Ops" }] }),
  component: Settings,
});

const secrets: Array<{ name: string; what: string; where: string; link: string }> = [
  {
    name: "LOVABLE_API_KEY",
    what: "Already provisioned. Powers Lovable AI Gateway calls — every agent reasoning step uses this.",
    where: "Auto-managed by Lovable. No action required.",
    link: "https://docs.lovable.dev/features/ai",
  },
  {
    name: "BROWSERBASE_API_KEY",
    what: "Lets Bridges Tester drive a real headless Chromium to walk through your apps.",
    where: "Browserbase dashboard → Settings → API Keys",
    link: "https://www.browserbase.com/settings",
  },
  {
    name: "BROWSERBASE_PROJECT_ID",
    what: "The Browserbase project that sessions will be created under.",
    where: "Browserbase dashboard → Projects",
    link: "https://www.browserbase.com/projects",
  },
  {
    name: "TESTER_WEBHOOK_SECRET",
    what: "Signs CI / external trigger requests to /api/public/runs/trigger and /api/public/webhooks/agent-event so we can verify them.",
    where: "Pick any long random string (you generate it).",
    link: "https://generate-secret.vercel.app/64",
  },
  {
    name: "RESEND_API_KEY (optional)",
    what: "Sends email alerts on completion, failed runs, or approval requests.",
    where: "Resend dashboard → API Keys",
    link: "https://resend.com/api-keys",
  },
];

function Settings() {
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What you need to wire up to switch from simulated to real backend execution.
      </p>

      <Card className="mt-6 border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4" /> Step 1 — Enable Lovable Cloud
          </CardTitle>
          <CardDescription>
            Cloud provides Postgres-backed agent_tasks / agent_runs / agent_approvals / errors tables,
            RLS, auth, screenshot storage, and pg_cron for the scheduled-trigger sweep. Cloud could not
            be enabled automatically — workspace is out of credits. Add credits, then ask me to enable it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="https://lovable.dev/settings/billing" target="_blank" rel="noreferrer">
              Add credits <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> Agents are live now
          </CardTitle>
          <CardDescription>
            Agent reasoning uses Lovable AI Gateway today — no Cloud required. Tasks, runs, and
            approvals are persisted in localStorage and will swap to real tables once Cloud is on.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Step 2 — Secrets
          </CardTitle>
          <CardDescription>
            Once Cloud is on, I'll prompt you to enter each of these securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {secrets.map((s) => (
              <li key={s.name} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <code className="rounded bg-muted px-2 py-1 text-xs font-medium">{s.name}</code>
                  <Button asChild size="sm" variant="ghost">
                    <a href={s.link} target="_blank" rel="noreferrer">
                      Get it <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.what}</p>
                <p className="text-xs text-muted-foreground">Where: {s.where}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Step 3 — Webhook URLs (live)
          </CardTitle>
          <CardDescription>External callers can POST to these endpoints today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <code className="block break-all rounded-md bg-muted p-2 text-xs">
            POST /api/public/webhooks/agent-event
            {"\n"}{`{ "source": "ci", "type": "build_failed", "title": "...", "description": "...", "agentType": "debug" }`}
          </code>
          <code className="block break-all rounded-md bg-muted p-2 text-xs">
            POST /api/public/runs/trigger  (Bridges Tester run)
          </code>
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground">
        Today: agents reason via Lovable AI; risky actions queue approvals but don't fire real external calls
        (no email/charge/deploy). Bridges Tester runs are simulated. All of this swaps to real execution
        when Cloud + Browserbase + optional Resend are configured.
      </p>
    </AppShell>
  );
}
