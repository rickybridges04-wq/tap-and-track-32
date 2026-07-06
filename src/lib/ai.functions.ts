// Server function: ask the agent LLM for a plan + final report.
// Returns a structured object the client can execute step-by-step.
import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const PlanSchema = z.object({
  agentSummary: z.string().describe("One-sentence summary of how the agent understood the task."),
  plan: z
    .array(
      z.object({
        tool: z.enum([
          "readTable",
          "listProjects",
          "listRuns",
          "listErrors",
          "runBridgesTester",
          "proposePlan",
          "markResolved",
          "updateRow",
          "deleteRow",
          "sendEmail",
          "chargeMoney",
          "deploy",
          "updateProdSetting",
        ]),
        reasoning: z.string(),
        args: z.string().describe("JSON-stringified arguments for the tool"),
      }),
    )
    .max(8),
  finalReport: z.string().describe("Markdown report shown to the user when the run completes."),
});

const InputSchema = z.object({
  agentType: z.string(),
  systemPrompt: z.string(),
  toolCatalog: z.string(),
  task: z.object({
    title: z.string(),
    description: z.string(),
    context: z.string().optional(),
  }),
  provider: z.enum(["lovable", "anthropic"]).optional(),
  model: z.string().optional(),
});

export const planAgentTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const provider = data.provider ?? "lovable";

    let model;
    let providerLabel: string;
    try {
      if (provider === "anthropic") {
        const akey = process.env.ANTHROPIC_API_KEY;
        if (!akey) throw new Error("ANTHROPIC_API_KEY is not configured");
        const anthropic = createAnthropic({ apiKey: akey });
        model = anthropic(data.model ?? "claude-sonnet-4-5");
        providerLabel = "Anthropic";
      } else {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) throw new Error("LOVABLE_API_KEY is not configured");
        const gateway = createLovableAiGatewayProvider(key);
        model = gateway(data.model ?? "google/gemini-3-flash-preview");
        providerLabel = "Lovable AI";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        agentSummary: `Agent ${data.agentType} could not initialize provider.`,
        plan: [],
        finalReport: `## Agent error\n\nProvider init failed:\n\n\`\`\`\n${message}\n\`\`\``,
      };
    }

    const system = `${data.systemPrompt}

You are part of an AI Operations Center. Output a short execution plan as structured JSON.

Available tools:
${data.toolCatalog}

Rules:
- Plan 2-6 tool calls maximum.
- Prefer safe read tools first (readTable, listProjects, listRuns, listErrors) to ground your answer.
- Use risky tools (updateRow, deleteRow, sendEmail, chargeMoney, deploy, updateProdSetting) only when the task clearly requires them — they will require human approval before executing.
- Always end with a clear markdown finalReport summarizing diagnosis, what you did, and what the user should do next.
- args MUST be a valid JSON string.`;

    const prompt = `Task title: ${data.task.title}
Description: ${data.task.description}
${data.task.context ? `\nContext:\n${data.task.context}` : ""}`;

    try {
      const { output } = await generateText({
        model,
        system,
        prompt,
        output: Output.object({ schema: PlanSchema }),
      });
      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        agentSummary: `Agent ${data.agentType} could not reach ${providerLabel}.`,
        plan: [],
        finalReport: `## Agent error\n\n${providerLabel} returned an error:\n\n\`\`\`\n${message}\n\`\`\`\n\nThe task has been marked failed. Check your credits/key or try again.`,
      };
    }
  });


/* ------------- Root-cause clustering of QA fixes ------------- */

const FindingInputSchema = z.object({
  id: z.string(),
  severity: z.string(),
  title: z.string(),
  suggestion: z.string(),
  page_url: z.string(),
});

const RootCauseInput = z.object({
  findings: z.array(FindingInputSchema).min(1).max(300),
});

const ClusterSchema = z.object({
  title: z.string().describe("Short root cause name (max 8 words)."),
  rootCause: z.string().describe("1-2 sentences explaining the underlying issue."),
  severity: z.enum(["critical", "high", "medium", "low"]),
  unifiedFix: z.string().describe("One concrete implementation step that resolves every finding in this cluster."),
  findingIds: z.array(z.string()).min(1),
  affectedPages: z.array(z.string()),
});

const RootCauseOutput = z.object({
  summary: z.string().describe("1-2 sentence overview of the clustered fix plan."),
  clusters: z.array(ClusterSchema).min(1).max(10),
});

export const analyzeFixRootCauses = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RootCauseInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("openai/gpt-5.5");

    const system = `You are a senior engineer triaging QA findings for a web app.
Group the given findings into the fewest possible root-cause clusters (aim for 3-8, never more than 10).
Every finding id MUST appear in exactly one cluster.
For each cluster:
- Identify the ONE underlying cause producing the symptoms.
- Write a single unifiedFix a developer can implement once to resolve all findings in the cluster.
- Set severity to the highest severity among the covered findings.
- List affectedPages as distinct page URLs from the covered findings.
Order clusters by severity (critical > high > medium > low), then by number of findings covered.`;

    const prompt = `Findings:\n${data.findings
      .map(
        (f) =>
          `- id=${f.id} | ${f.severity.toUpperCase()} | ${f.title}\n  page: ${f.page_url}\n  suggestion: ${f.suggestion}`,
      )
      .join("\n")}`;

    try {
      const { output } = await generateText({
        model,
        system,
        prompt,
        output: Output.object({ schema: RootCauseOutput }),
      });
      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Root-cause analysis failed: ${message}`);
    }
  });
