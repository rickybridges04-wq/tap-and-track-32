import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, KeyRound, Cloud, Globe, Bot, Eye, EyeOff, Check } from "lucide-react";
import { useMounted } from "@/lib/agent-store";
import { useSecret, setSecret, clearSecret } from "@/lib/secrets-store";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Bridges Ops" }] }),
  component: Settings,
});

type SecretDef = {
  name: string;
  managed?: boolean;
  what: string;
  where: string;
  link: string;
};

const secrets: SecretDef[] = [
  {
    name: "LOVABLE_API_KEY",
    managed: true,
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
    name: "RESEND_API_KEY",
    what: "Sends email alerts on completion, failed runs, or approval requests. (optional)",
    where: "Resend dashboard → API Keys",
    link: "https://resend.com/api-keys",
  },
];

function SecretRow({ def }: { def: SecretDef }) {
  const mounted = useMounted();
  const stored = useSecret(def.name);
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const hasValue = mounted && !!stored;
  const masked = stored ? "•".repeat(Math.min(stored.length, 24)) : "";

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-xs font-medium">{def.name}</code>
          {def.managed ? (
            <Badge variant="secondary" className="text-[10px]">Managed by Lovable</Badge>
          ) : hasValue ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 text-[10px]">
              <Check className="mr-1 h-3 w-3" /> Saved locally
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Not set</Badge>
          )}
        </div>
        <Button asChild size="sm" variant="ghost">
          <a href={def.link} target="_blank" rel="noreferrer">
            Get it <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{def.what}</p>
      <p className="text-xs text-muted-foreground">Where: {def.where}</p>

      {!def.managed && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Input
              type={reveal ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder={hasValue ? masked : `Paste ${def.name}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="pr-9 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={reveal ? "Hide" : "Show"}
            >
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button
            size="sm"
            disabled={!draft.trim()}
            onClick={() => {
              setSecret(def.name, draft.trim());
              setDraft("");
              setJustSaved(true);
              setTimeout(() => setJustSaved(false), 1500);
            }}
          >
            {justSaved ? "Saved" : "Save"}
          </Button>
          {hasValue && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => clearSecret(def.name)}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

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
            Agent reasoning uses Lovable AI Gateway by default. Switch to Anthropic (Claude) below to
            A/B test reasoning quality. Tasks/runs/approvals persist in localStorage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProviderSelector />
        </CardContent>
      </Card>


      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Step 2 — Secrets
          </CardTitle>
          <CardDescription>
            Paste keys as you get them. Stored in this browser only (localStorage) until Lovable Cloud is
            enabled — then I'll promote them to real Cloud secrets. Don't paste production secrets on a
            shared device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {secrets.map((s) => (
              <SecretRow key={s.name} def={s} />
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

function ProviderSelector() {
  const mounted = useMounted();
  const [provider, setProviderState] = useState<"lovable" | "anthropic">("lovable");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const v = window.localStorage.getItem("bridges.agentProvider");
      if (v === "anthropic" || v === "lovable") setProviderState(v);
    }
  }, []);

  function pick(p: "lovable" | "anthropic") {
    setProviderState(p);
    if (typeof window !== "undefined") window.localStorage.setItem("bridges.agentProvider", p);
  }
  if (!mounted) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant={provider === "lovable" ? "default" : "outline"}
        onClick={() => pick("lovable")}
      >
        Lovable AI (Gemini) {provider === "lovable" && <Check className="ml-1 h-3.5 w-3.5" />}
      </Button>
      <Button
        size="sm"
        variant={provider === "anthropic" ? "default" : "outline"}
        onClick={() => pick("anthropic")}
      >
        Anthropic (Claude Sonnet 4.5) {provider === "anthropic" && <Check className="ml-1 h-3.5 w-3.5" />}
      </Button>
      <Badge variant="secondary" className="ml-auto">
        Requires ANTHROPIC_API_KEY {provider === "anthropic" ? "· active" : ""}
      </Badge>
    </div>
  );
}

