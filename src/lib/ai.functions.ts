// Server function: ask the agent LLM for a plan + final report.
// Returns a structured object the client can execute step-by-step.
import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
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
});

export const planAgentTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

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
      // Fallback so the agent loop never hard-fails the UI.
      return {
        agentSummary: `Agent ${data.agentType} could not reach the AI gateway.`,
        plan: [],
        finalReport: `## Agent error\n\nThe AI gateway returned an error:\n\n\`\`\`\n${message}\n\`\`\`\n\nThe task has been marked failed. Check your credits or try again.`,
      };
    }
  });
