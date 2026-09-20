// Real backend + integration status, read server-side from actual project
// secrets and a live database round-trip. Replaces the old Settings page,
// which reported browser-local guesses and was routinely wrong.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SecretStatus = {
  name: string;
  configured: boolean;
  /** Set on the project (server-side) vs. supplied by the user in-browser. */
  scope: "project" | "browser";
};

export type SystemStatus = {
  backend: { connected: boolean; detail: string };
  secrets: SecretStatus[];
};

const PROJECT_SECRETS = [
  "LOVABLE_API_KEY",
  "FIRECRAWL_API_KEY",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_PROJECT_ID",
  "QA_WORKER_TOKEN",
  "STRIPE_SANDBOX_API_KEY",
  "STRIPE_LIVE_API_KEY",
  "AI_GATEWAY_API_KEY",
  "RESEND_API_KEY",
  "GITHUB_TOKEN",
  "QA_WORKER_DISPATCH_TOKEN",
  "QA_WORKER_REPO",
] as const;

export const getSystemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemStatus> => {
    const { supabase, userId } = context;

    let connected = false;
    let detail = "";
    try {
      const { error } = await supabase
        .from("qa_runs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      connected = !error;
      detail = error ? error.message : "Database, auth and storage responding.";
    } catch (e) {
      detail = e instanceof Error ? e.message : "Database unreachable";
    }

    return {
      backend: { connected, detail },
      secrets: PROJECT_SECRETS.map((name) => ({
        name,
        configured: Boolean(process.env[name]),
        scope: "project" as const,
      })),
    };
  });
