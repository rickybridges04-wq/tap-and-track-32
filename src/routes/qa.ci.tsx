import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ApiKeysCard } from "@/components/ApiKeysCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, GitBranch } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/qa/ci")({
  head: () => ({
    meta: [
      { title: "CI integration · Synapse QA OS" },
      {
        name: "description",
        content:
          "Start automated test runs from your build pipeline and fail the build on new regressions, using a copy-paste GitHub Actions workflow.",
      },
      { property: "og:title", content: "CI integration · Synapse QA OS" },
      {
        property: "og:description",
        content: "Run your test suites on every push and block merges when checks regress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CiPage,
});

const WORKFLOW = `name: QA

on:
  push:
    branches: [main]
  pull_request:

jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - name: Start run
        id: start
        run: |
          RESPONSE=$(curl -sS -X POST "$QA_BASE_URL/api/v1/runs" \\
            -H "Authorization: Bearer $QA_API_KEY" \\
            -H "Content-Type: application/json" \\
            -d "{\\"project_id\\":\\"$QA_PROJECT_ID\\",\\"kind\\":\\"automated\\",\\"ref\\":\\"$GITHUB_REF_NAME\\",\\"commit_sha\\":\\"$GITHUB_SHA\\"}")
          echo "$RESPONSE"
          RUN_ID=$(echo "$RESPONSE" | jq -r '.run_id')
          if [ "$RUN_ID" = "null" ] || [ -z "$RUN_ID" ]; then
            echo "Could not start the run"; exit 1
          fi
          echo "run_id=$RUN_ID" >> "$GITHUB_OUTPUT"
        env:
          QA_BASE_URL: \${{ vars.QA_BASE_URL }}
          QA_API_KEY: \${{ secrets.QA_API_KEY }}
          QA_PROJECT_ID: \${{ vars.QA_PROJECT_ID }}

      - name: Wait for the run and check the result
        run: |
          DEADLINE=$(( $(date +%s) + 900 ))   # 15 minutes
          while :; do
            STATUS_JSON=$(curl -sS "$QA_BASE_URL/api/v1/runs/\${{ steps.start.outputs.run_id }}" \\
              -H "Authorization: Bearer $QA_API_KEY")
            STATUS=$(echo "$STATUS_JSON" | jq -r '.status')
            echo "status: $STATUS"
            if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then break; fi
            if [ "$(date +%s)" -ge "$DEADLINE" ]; then
              echo "Timed out after 15 minutes"; exit 1
            fi
            sleep 15
          done

          echo "$STATUS_JSON" | jq -r '
            "Pass rate: \\(.pass_rate)%  (\\(.passed) passed, \\(.failed) failed, \\(.errored) errors of \\(.total))",
            "Readiness score: \\(.score)  verdict: \\(.verdict)",
            "Newly failing: \\(.newly_failing | if length == 0 then "none" else join(", ") end)",
            "Report: \\(.report_url)"'

          FAILED=$(echo "$STATUS_JSON" | jq -r '.failed')
          NEW=$(echo "$STATUS_JSON" | jq -r '.newly_failing | length')
          VERDICT=$(echo "$STATUS_JSON" | jq -r '.verdict')
          if [ "$FAILED" -gt 0 ] || [ "$NEW" -gt 0 ] || [ "$VERDICT" = "block" ]; then
            echo "::error::QA checks did not pass"; exit 1
          fi
        env:
          QA_BASE_URL: \${{ vars.QA_BASE_URL }}
          QA_API_KEY: \${{ secrets.QA_API_KEY }}
`;

function Block({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            toast.success("Copied");
          }}
        >
          <Copy className="mr-1 h-3 w-3" /> Copy
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CiPage() {
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <AppShell>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" /> Synapse QA OS
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">CI integration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kick off a test run on every push and fail the build when something that used to pass
          starts failing.
        </p>
      </div>

      <ApiKeysCard />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Before you copy the workflow</CardTitle>
          <CardDescription>Three values, set once in your repository settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Secret</strong> <code>QA_API_KEY</code> — a key created above.
          </p>
          <p>
            <strong>Variable</strong> <code>QA_BASE_URL</code> —{" "}
            <code>{origin || "https://your-app.lovable.app"}</code>
          </p>
          <p>
            <strong>Variable</strong> <code>QA_PROJECT_ID</code> — the id in the address bar of the
            test project page.
          </p>
          <p className="text-muted-foreground">
            The run needs a browser worker listening to the queue. If you set{" "}
            <code>QA_WORKER_REPO</code> and <code>QA_WORKER_DISPATCH_TOKEN</code>, queuing a run also
            nudges that repository to start one.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">.github/workflows/qa.yml</CardTitle>
          <CardDescription>
            Starts a run, polls for up to 15 minutes, prints a summary, and exits non-zero on
            failures, new regressions or a blocking verdict.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Block title="Workflow" code={WORKFLOW} />
          <Block
            title="Or call it directly"
            code={`curl -X POST "${origin || "https://your-app.lovable.app"}/api/v1/runs" \\
  -H "Authorization: Bearer $QA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"project_id":"<project-id>"}'

curl "${origin || "https://your-app.lovable.app"}/api/v1/runs/<run-id>" \\
  -H "Authorization: Bearer $QA_API_KEY"`}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
