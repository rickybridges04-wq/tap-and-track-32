import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink, KeyRound, Cloud, Globe, Check, Github,
  Loader2, AlertTriangle, CircleDashed,
} from "lucide-react";
import { useMounted } from "@/lib/agent-store";
import { useSecret, setSecret, clearSecret } from "@/lib/secrets-store";
import { ApiKeysCard } from "@/components/ApiKeysCard";
import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { getSystemStatus, type SecretStatus } from "@/lib/system-status.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Walkthrough Wizard QAOS" },
      { name: "description", content: "Manage integrations, API keys, bug tracking and your account for Walkthrough Wizard QAOS." },
      { property: "og:title", content: "Settings · Walkthrough Wizard QAOS" },
      { property: "og:description", content: "Manage integrations, API keys, bug tracking and your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

type SecretDef = {
  name: string;
  what: string;
  where: string;
  link: string;
  required: boolean;
};

const SECRET_DOCS: SecretDef[] = [
  {
    name: "LOVABLE_API_KEY",
    what: "Powers AI reasoning for crawl inspection, findings and root-cause analysis.",
    where: "Managed automatically for this project.",
    link: "https://docs.lovable.dev/features/ai",
    required: true,
  },
  {
    name: "FIRECRAWL_API_KEY",
    what: "Fetches and renders the pages of the app being tested.",
    where: "Firecrawl dashboard → API Keys",
    link: "https://www.firecrawl.dev/app/api-keys",
    required: true,
  },
  {
    name: "STRIPE_SANDBOX_API_KEY",
    what: "Test-mode payments for the Pro subscription.",
    where: "Managed automatically once payments are enabled.",
    link: "https://dashboard.stripe.com/test/apikeys",
    required: true,
  },
  {
    name: "STRIPE_LIVE_API_KEY",
    what: "Live payments for the Pro subscription.",
    where: "Managed automatically once live payments are enabled.",
    link: "https://dashboard.stripe.com/apikeys",
    required: true,
  },
  {
    name: "QA_WORKER_TOKEN",
    what: "Authenticates the external browser worker that runs scripted test cases.",
    where: "Any long random string you generate.",
    link: "https://generate-secret.vercel.app/64",
    required: true,
  },
  {
    name: "BROWSERBASE_API_KEY",
    what: "Hosted Chromium sessions for browser-driven checks.",
    where: "Browserbase dashboard → Settings → API Keys",
    link: "https://www.browserbase.com/settings",
    required: false,
  },
  {
    name: "BROWSERBASE_PROJECT_ID",
    what: "The Browserbase project sessions are created under.",
    where: "Browserbase dashboard → Projects",
    link: "https://www.browserbase.com/projects",
    required: false,
  },
  {
    name: "AI_GATEWAY_API_KEY",
    what: "Routes AI calls through the BAE AI Gateway instead of calling a model provider directly.",
    where: "BAE AI Gateway project → API keys",
    link: "https://supabase.com/dashboard",
    required: false,
  },
  {
    name: "GITHUB_TOKEN",
    what: "Files bugs as GitHub issues. Filing is skipped cleanly when absent.",
    where: "GitHub → Settings → Developer settings → Personal access tokens",
    link: "https://github.com/settings/personal-access-tokens",
    required: false,
  },
  {
    name: "QA_WORKER_DISPATCH_TOKEN",
    what: "Notifies your worker repository when new test jobs are queued.",
    where: "GitHub personal access token with repo dispatch scope.",
    link: "https://github.com/settings/personal-access-tokens",
    required: false,
  },
  {
    name: "QA_WORKER_REPO",
    what: "The owner/repo that receives the queued-jobs notification.",
    where: "You set this to your worker repository.",
    link: "https://github.com/new",
    required: false,
  },
  {
    name: "RESEND_API_KEY",
    what: "Sends email alerts for completed or failed runs.",
    where: "Resend dashboard → API Keys",
    link: "https://resend.com/api-keys",
    required: false,
  },
];

function BackendCard() {
  const q = useQuery({ queryKey: ["system-status"], queryFn: () => getSystemStatus() });
  const b = q.data?.backend;

  if (q.isLoading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking backend…
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const ok = !!b?.connected;
  return (
    <Card className={"mt-6 " + (ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/50 bg-destructive/5")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="h-4 w-4" /> Backend
          {ok ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 text-[10px]">
              <Check className="mr-1 h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px]">Unreachable</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {b?.detail ?? "Status unknown."}{" "}
          {ok && "Runs, pages, findings, bugs and screenshots are stored server-side."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function SecretsCard() {
  const q = useQuery({ queryKey: ["system-status"], queryFn: () => getSystemStatus() });
  const byName = new Map<string, SecretStatus>((q.data?.secrets ?? []).map((s) => [s.name, s]));
  const missingRequired = SECRET_DOCS.filter(
    (d) => d.required && q.data && !byName.get(d.name)?.configured,
  );

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Integrations
        </CardTitle>
        <CardDescription>
          Live status, read from this project's server-side secrets. Values are never shown here.
          Add or change one in Project Settings → Secrets.
          {missingRequired.length > 0 && (
            <span className="mt-2 flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {missingRequired.length} required integration
              {missingRequired.length === 1 ? "" : "s"} still missing.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading real status…
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {SECRET_DOCS.map((def) => {
              const configured = byName.get(def.name)?.configured ?? false;
              return (
                <li key={def.name} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-xs font-medium">{def.name}</code>
                      {configured ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 text-[10px]">
                          <Check className="mr-1 h-3 w-3" /> Set
                        </Badge>
                      ) : def.required ? (
                        <Badge variant="destructive" className="text-[10px]">Missing — required</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          <CircleDashed className="mr-1 h-3 w-3" /> Not set — optional
                        </Badge>
                      )}
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <a href={def.link} target="_blank" rel="noreferrer">
                        Where to get it <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{def.what}</p>
                  <p className="text-xs text-muted-foreground">Source: {def.where}</p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function GithubCard() {
  const mounted = useMounted();
  const repo = useSecret("GITHUB_REPO");
  const [draft, setDraft] = useState("");
  const valid = /^[\w.-]+\/[\w.-]+$/.test(draft.trim());
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Github className="h-4 w-4" /> Bug tracking → GitHub (optional)
        </CardTitle>
        <CardDescription>
          The repository bugs should be filed into, as owner/repo. This is a preference saved in this
          browser, not a secret. The token itself is the project secret GITHUB_TOKEN above — when it
          is missing, filing an issue is skipped and nothing else breaks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs font-mono text-xs"
            placeholder={mounted && repo ? repo : "owner/repo"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button size="sm" disabled={!valid} onClick={() => { setSecret("GITHUB_REPO", draft.trim()); setDraft(""); }}>
            Save repo
          </Button>
          {mounted && repo && (
            <>
              <Badge variant="secondary" className="text-[10px]">{repo}</Badge>
              <Button size="sm" variant="ghost" onClick={() => clearSecret("GITHUB_REPO")}>Clear</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Settings() {
  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live integration status, API keys, bug tracking and your account.
      </p>

      <BackendCard />
      <SecretsCard />
      <GithubCard />

      <div className="mt-6">
        <ApiKeysCard />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Webhook and worker endpoints
          </CardTitle>
          <CardDescription>External callers can POST to these endpoints.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <code className="block break-all rounded-md bg-muted p-2 text-xs">
            POST /api/public/webhooks/agent-event
          </code>
          <code className="block break-all rounded-md bg-muted p-2 text-xs">
            POST /api/public/worker/claim · /heartbeat · /report (Bearer QA_WORKER_TOKEN)
          </code>
          <code className="block break-all rounded-md bg-muted p-2 text-xs">
            POST /api/v1/runs · GET /api/v1/runs/:id (Bearer API key)
          </code>
        </CardContent>
      </Card>

      <DeleteAccountCard />
    </AppShell>
  );
}
