// Synapse QA OS — AI failure analyst (server-only).
//
// Playwright decides pass/fail. The AI never decides a verdict; it only explains
// a failure that already happened. One analysis per unique error signature:
// repeats increment the counter and never spend a second AI call.
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const MODEL = "google/gemini-3.8-flash";

const SYSTEM = [
  "You are a QA failure analyst.",
  "A real browser (Playwright) already executed this test and already decided it FAILED.",
  "That verdict is final evidence. Never contradict it, never say the test passed,",
  "never say the failure is a false positive, and never re-judge the outcome.",
  "Your only job is to explain the most likely cause of the failure and how to reproduce it.",
  "Base every statement on the evidence provided. If the evidence is thin, say so and lower your confidence.",
  "Never invent credentials, URLs or stack traces that are not in the evidence.",
].join(" ");

const Analysis = z.object({
  likely_cause: z.string(),
  repro_steps: z.array(z.string()),
  suggested_severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number(),
});

export type FailureEvidence = {
  case_title: string;
  case_code: string;
  steps: unknown;
  failed_step_index: number | null;
  error_message: string | null;
  console_errors: string[];
  network_failures: unknown[];
  axe_violations: unknown[];
  url: string;
};

/** Strips anything credential-shaped before the evidence leaves the server. */
function redact(value: unknown): unknown {
  const json = JSON.stringify(value ?? null);
  if (!json) return value;
  const safe = json
    .replace(/\{\{\s*password\s*\}\}/gi, "<password placeholder>")
    .replace(/\{\{\s*username\s*\}\}/gi, "<username placeholder>")
    .replace(/("(?:password|passwd|pwd|secret|token|api_?key|authorization)"\s*:\s*)"[^"]*"/gi, '$1"<redacted>"');
  try {
    return JSON.parse(safe);
  } catch {
    return value;
  }
}

function buildPrompt(e: FailureEvidence): string {
  return [
    `URL: ${e.url}`,
    `Test case: ${e.case_code} — ${e.case_title}`,
    `Steps: ${JSON.stringify(redact(e.steps))}`,
    `Failed at step index: ${e.failed_step_index ?? "unknown"}`,
    `Error message: ${e.error_message ?? "(none reported)"}`,
    `Console errors: ${JSON.stringify(e.console_errors.slice(0, 20))}`,
    `Failed network requests: ${JSON.stringify(redact(e.network_failures).valueOf())}`,
    `Accessibility violations: ${JSON.stringify(redact(e.axe_violations).valueOf())}`,
    "",
    "Return JSON only: likely_cause (one short paragraph), repro_steps (array of short imperative strings),",
    "suggested_severity (low|medium|high|critical), confidence (0 to 1).",
  ].join("\n");
}

type AnalysisResult = z.infer<typeof Analysis>;

async function callAi(evidence: FailureEvidence, apiKey: string): Promise<AnalysisResult> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const { output } = await generateText({
    model: gateway(MODEL),
    system: SYSTEM,
    prompt: buildPrompt(evidence),
    output: Output.object({ schema: Analysis }),
  });
  return Analysis.parse(output);
}

type AdminClient = {
  from: (table: string) => any;
};

export type AnalyseOutcome = { kind: "existing" | "created" | "skipped"; warning?: string };

/**
 * Group a failed result by its error signature and analyse it once.
 * Returns a warning string (for the run's warnings array) when nothing was stored.
 */
export async function analyseFailure(opts: {
  admin: AdminClient;
  userId: string;
  projectId: string | null;
  resultId: string | null;
  signature: string;
  evidence: FailureEvidence;
}): Promise<AnalyseOutcome> {
  const { admin, userId, projectId, resultId, signature, evidence } = opts;

  const { data: existing, error: readErr } = await admin
    .from("failure_analyses")
    .select("id, occurrences")
    .eq("user_id", userId)
    .eq("error_signature", signature)
    .maybeSingle();
  if (readErr) return { kind: "skipped", warning: `failure analysis lookup failed: ${readErr.message}` };

  if (existing) {
    // Same root cause seen again — count it, never pay for a second AI call.
    const { error } = await admin
      .from("failure_analyses")
      .update({
        occurrences: (existing.occurrences ?? 1) + 1,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { kind: "skipped", warning: `failure analysis update failed: ${error.message}` };
    return { kind: "existing" };
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return { kind: "skipped", warning: "failure analysis skipped: AI is not configured for this project." };
  }

  let analysis: AnalysisResult | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      analysis = await callAi(evidence, apiKey);
      break;
    } catch (err) {
      lastError =
        NoObjectGeneratedError.isInstance(err)
          ? "the model did not return valid JSON"
          : err instanceof Error
            ? err.message
            : String(err);
    }
  }
  if (!analysis) {
    return {
      kind: "skipped",
      warning: `AI failure analysis produced nothing usable after two attempts (${lastError}). The measured pass/fail result is unaffected.`,
    };
  }

  const { error: insErr } = await admin.from("failure_analyses").insert({
    user_id: userId,
    project_id: projectId,
    error_signature: signature,
    first_seen_result_id: resultId,
    occurrences: 1,
    last_seen_at: new Date().toISOString(),
    likely_cause: analysis.likely_cause.slice(0, 4000),
    repro_steps: analysis.repro_steps.slice(0, 20).map((s) => String(s).slice(0, 500)),
    suggested_severity: analysis.suggested_severity,
    confidence: Math.min(1, Math.max(0, analysis.confidence)),
    basis: "inferred",
    model: MODEL,
  });
  if (insErr) {
    // A concurrent report may have inserted the same signature first.
    if (/duplicate key/i.test(insErr.message)) return { kind: "existing" };
    return { kind: "skipped", warning: `failure analysis insert failed: ${insErr.message}` };
  }
  return { kind: "created" };
}
