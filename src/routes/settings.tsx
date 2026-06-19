import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, KeyRound, Cloud, Globe } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Bridges Tester" }] }),
  component: Settings,
});

const secrets: Array<{ name: string; what: string; where: string; link: string }> = [
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
    what: "Signs CI / external trigger requests to /api/public/runs/trigger so we can verify them.",
    where: "Pick any long random string (you generate it).",
    link: "https://generate-secret.vercel.app/64",
  },
  {
    name: "RESEND_API_KEY (optional)",
    what: "Sends email alerts when a run finishes with new regressions.",
    where: "Resend dashboard → API Keys",
    link: "https://resend.com/api-keys",
  },
];

function Settings() {
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What you still need to wire up to switch from simulated runs to real ones.
      </p>

      <Card className="mt-6 border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-4 w-4" /> Step 1 — Enable Lovable Cloud
          </CardTitle>
          <CardDescription>
            Cloud provides the database (projects, runs, findings), auth, file storage for screenshots,
            and the scheduler (pg_cron) that fires scheduled runs. Cloud could not be enabled automatically
            because the workspace is out of credits. Add credits, then ask me to enable it.
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
            <KeyRound className="h-4 w-4" /> Step 2 — Secrets you'll need
          </CardTitle>
          <CardDescription>
            Once Cloud is on, I'll prompt you to enter each of these securely. Here's what each one is and where to get it.
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
            <Globe className="h-4 w-4" /> Step 3 — Public webhook URL
          </CardTitle>
          <CardDescription>
            Once Cloud is on, point your CI / pg_cron at this stable URL:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block break-all rounded-md bg-muted p-2 text-xs">
            POST https://&lt;your-project&gt;.lovable.app/api/public/runs/trigger
          </code>
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground">
        Until Cloud + Browserbase are connected, all runs are <strong>simulated</strong> client-side so you can
        explore the UI and reporting flow end-to-end.
      </p>
    </AppShell>
  );
}
