// Synapse QA OS — per-page AI inspection (one call per persona).
import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { PERSONAS, type PersonaId } from "@/lib/qa/personas";

// Loose schema for the model — no length caps, no strict enums.
// Everything is validated + normalized in code afterwards.
const LooseFinding = z.object({
  category: z.string().optional(),
  severity: z.string().optional(),
  confidence: z.number().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  suggestion: z.string().nullable().optional(),
});

const LooseInspection = z.object({
  summary: z.string().optional(),
  findings: z.array(LooseFinding).optional(),
});

const CATEGORIES = ["functional", "visual", "accessibility", "performance"] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;

type NormalizedFinding = {
  category: (typeof CATEGORIES)[number];
  severity: (typeof SEVERITIES)[number];
  confidence: number;
  title: string;
  detail: string;
  suggestion?: string;
};

function coerceCategory(v: unknown): (typeof CATEGORIES)[number] {
  const s = String(v ?? "").toLowerCase().trim();
  if ((CATEGORIES as readonly string[]).includes(s)) return s as (typeof CATEGORIES)[number];
  if (/a11y|access/.test(s)) return "accessibility";
  if (/perf|speed|slow/.test(s)) return "performance";
  if (/visual|design|ui|style|layout/.test(s)) return "visual";
  return "functional";
}

function coerceSeverity(v: unknown): (typeof SEVERITIES)[number] {
  const s = String(v ?? "").toLowerCase().trim();
  if ((SEVERITIES as readonly string[]).includes(s)) return s as (typeof SEVERITIES)[number];
  if (/block|crit|sev1|p0/.test(s)) return "critical";
  if (/high|major|sev2|p1/.test(s)) return "high";
  if (/low|minor|nit|trivial|info|p3/.test(s)) return "low";
  return "medium";
}

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const x = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, x));
}

function truncate(s: unknown, max: number): string {
  const str = typeof s === "string" ? s : String(s ?? "");
  return str.length > max ? str.slice(0, max - 1).trimEnd() + "…" : str;
}

function normalize(raw: unknown): { summary: string; findings: NormalizedFinding[] } {
  const parsed = LooseInspection.safeParse(raw);
  const obj = parsed.success ? parsed.data : {};
  const summary = truncate(obj.summary ?? "", 400);
  const findings: NormalizedFinding[] = (obj.findings ?? [])
    .map((f) => {
      const title = truncate(f?.title, 160);
      const detail = truncate(f?.detail, 900);
      if (!title && !detail) return null;
      const suggestion = f?.suggestion == null ? undefined : truncate(f.suggestion, 500);
      return {
        category: coerceCategory(f?.category),
        severity: coerceSeverity(f?.severity),
        confidence: clamp(f?.confidence, 0, 1, 0.6),
        title: title || detail.slice(0, 80),
        detail: detail || title,
        suggestion,
      } satisfies NormalizedFinding;
    })
    .filter((x): x is NormalizedFinding => x != null)
    .slice(0, 6);
  return { summary, findings };
}

function extractJson(text: string): unknown | null {
  if (!text) return null;
  // Strip ```json fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = body.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

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

Each finding must include:
- category: one of "functional" | "visual" | "accessibility" | "performance"
- severity: one of "critical" | "high" | "medium" | "low"
- confidence: number 0..1
- title: short (<= 140 chars)
- detail: 1-3 sentences (<= 800 chars)
- suggestion: optional short fix (omit if none)

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

    // Attempt 1: structured output with loose schema.
    try {
      const { output } = await generateText({
        model,
        system,
        prompt,
        output: Output.object({ schema: LooseInspection }),
      });
      const norm = normalize(output);
      return { ok: true as const, ...norm };
    } catch (err) {
      const isSchemaFail =
        NoObjectGeneratedError.isInstance?.(err) ||
        /did not match schema|No object generated|response_format/i.test(
          err instanceof Error ? err.message : String(err),
        );
      // If the SDK captured the raw text on the error, try to salvage it.
      const rawText = (err as { text?: string } | undefined)?.text;
      if (rawText) {
        const salvaged = extractJson(rawText);
        if (salvaged) {
          const norm = normalize(salvaged);
          return { ok: true as const, ...norm };
        }
      }
      if (!isSchemaFail) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : String(err),
          summary: "",
          findings: [] as NormalizedFinding[],
        };
      }
    }

    // Attempt 2: plain text, extract JSON ourselves.
    try {
      const { text } = await generateText({
        model,
        system:
          system +
          `\n\nReturn ONLY a single JSON object, no prose, no code fences. Shape: {"summary": string, "findings": Finding[]}.`,
        prompt,
      });
      const salvaged = extractJson(text);
      if (!salvaged) {
        return {
          ok: false as const,
          error: `Model did not return parseable JSON. Preview: ${text.slice(0, 200)}`,
          summary: "",
          findings: [] as NormalizedFinding[],
        };
      }
      const norm = normalize(salvaged);
      return { ok: true as const, ...norm };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
        summary: "",
        findings: [] as NormalizedFinding[],
      };
    }
  });
