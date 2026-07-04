// Synapse QA OS — Firecrawl-backed crawler (Worker-runtime safe).
// Playwright/Browserbase browser drivers cannot bundle for the Cloudflare
// Worker runtime, so we use Firecrawl's HTTP API for real page fetches.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

function firecrawlKey(): string {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("FIRECRAWL_API_KEY not configured");
  return k;
}

const MapInput = z.object({
  url: z.string().url(),
  limit: z.number().int().min(1).max(100).default(15),
});

export const mapSite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MapInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${FIRECRAWL_BASE}/map`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey()}`,
        },
        body: JSON.stringify({ url: data.url, limit: data.limit }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false as const, error: `Firecrawl map ${res.status}: ${text.slice(0, 200)}` };
      }
      const json = (await res.json()) as { links?: string[] };
      const links = (json.links ?? []).slice(0, data.limit);
      return { ok: true as const, links };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

const ScrapeInput = z.object({
  url: z.string().url(),
  withScreenshot: z.boolean().default(false),
});

export const scrapePage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScrapeInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const formats: string[] = ["markdown", "links"];
      if (data.withScreenshot) formats.push("screenshot");
      const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey()}`,
        },
        body: JSON.stringify({ url: data.url, formats }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false as const, error: `Firecrawl scrape ${res.status}: ${text.slice(0, 200)}` };
      }
      const json = (await res.json()) as {
        data?: {
          markdown?: string;
          links?: string[];
          screenshot?: string;
          metadata?: { title?: string; statusCode?: number };
        };
      };
      const d = json.data ?? {};
      return {
        ok: true as const,
        page: {
          url: data.url,
          title: d.metadata?.title,
          status: d.metadata?.statusCode,
          links: (d.links ?? []).slice(0, 50),
          markdownPreview: (d.markdown ?? "").slice(0, 4000),
          screenshot: d.screenshot,
        },
      };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
