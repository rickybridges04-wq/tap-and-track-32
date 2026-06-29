// Synapse QA OS — per-page AI inspection (one call per persona).
import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { PERSONAS, type PersonaId } from "@/lib/qa/personas";

const FindingSchema = z.object({
  category: z.enum(["functional", "visual", "accessibility", "performance"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  confidence: z.number().min(0).max(1),
  title: z.string().max(120),
  detail: z.string().max(800),
  suggestion: z.string().max(400).optional(),
});

const InspectionSchema = z.object({
  summary: z.string().max(280),
  findings: z.array(FindingSchema).max(8),
});

const InspectInput = z.object({
  personaId: z.string(),
  page: z.object({
    url: z.string(),
    title: z.string().optional(),
    links: z.array(z.string()).default([]),
    markdownPreview: z.string().default(""),
  }),
});

export const inspectPage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InspectInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const persona = PERSONAS[data.personaId as PersonaId];
    if (!persona) throw new Error(`Unknown persona: ${data.personaId}`);

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `${persona.systemPrompt}

You are inspecting ONE page of a web application as part of Synapse QA OS.
Return at most 6 specific, evidence-based findings. Do NOT invent issues you cannot point to in the content.
If the page looks fine for your persona, return an empty findings array and say so in the summary.

Severity guide:
- critical: blocks core flow (broken auth, payment, navigation, 500s)
- high: significant UX or accessibility failure
- medium: noticeable but not blocking
- low: nit / polish`;

    const prompt = `URL: ${data.page.url}
Title: ${data.page.title ?? "(unknown)"}
Outbound links (sample): ${data.page.links.slice(0, 20).join(", ") || "(none discovered)"}

Page content (markdown, truncated):
---
${data.page.markdownPreview || "(empty)"}
---`;

    try {
      const { output } = await generateText({
        model,
        system,
        prompt,
        output: Output.object({ schema: InspectionSchema }),
      });
      return { ok: true as const, ...output };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
        summary: "",
        findings: [],
      };
    }
  });
