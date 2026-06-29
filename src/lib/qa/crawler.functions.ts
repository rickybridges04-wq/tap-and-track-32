// Synapse QA OS — Firecrawl crawler server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MapInput = z.object({
  url: z.string().url(),
  limit: z.number().int().min(1).max(100).default(15),
});

export const mapSite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MapInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey });

    try {
      const result: any = await fc.map(data.url, { limit: data.limit });
      const links: string[] = Array.isArray(result?.links)
        ? result.links.map((l: any) => (typeof l === "string" ? l : l?.url)).filter(Boolean)
        : [];
      return { ok: true as const, links: links.slice(0, data.limit) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

const ScrapeInput = z.object({
  url: z.string().url(),
  withScreenshot: z.boolean().default(true),
});

export const scrapePage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScrapeInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey });

    try {
      const formats: any[] = ["markdown", "links"];
      if (data.withScreenshot) formats.push("screenshot");
      const result: any = await fc.scrape(data.url, {
        formats,
        onlyMainContent: false,
      });

      const markdown: string = result?.markdown ?? result?.data?.markdown ?? "";
      const links: string[] = (result?.links ?? result?.data?.links ?? []).filter(
        (l: unknown): l is string => typeof l === "string",
      );
      const screenshot: string | undefined =
        result?.screenshot ?? result?.data?.screenshot ?? undefined;
      const metadata = result?.metadata ?? result?.data?.metadata ?? {};

      return {
        ok: true as const,
        page: {
          url: data.url,
          title: metadata?.title as string | undefined,
          status: metadata?.statusCode as number | undefined,
          links: Array.from(new Set(links)).slice(0, 50),
          screenshot,
          markdownPreview: markdown.slice(0, 4000),
        },
      };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
