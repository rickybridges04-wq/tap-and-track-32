// Synapse QA OS — Browserbase-powered crawler.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MapInput = z.object({
  url: z.string().url(),
  limit: z.number().int().min(1).max(100).default(15),
});

function sameOrigin(base: URL, href: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.origin !== base.origin) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export const mapSite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MapInput.parse(input))
  .handler(async ({ data }) => {
    const { withPage } = await import("@/lib/browserbase.server");
    try {
      const links = await withPage(async (page) => {
        await page.goto(data.url, { waitUntil: "domcontentloaded", timeout: 45000 });
        const hrefs: string[] = await page.$$eval("a[href]", (as) =>
          (as as HTMLAnchorElement[]).map((a) => a.getAttribute("href") ?? "").filter(Boolean),
        );
        const base = new URL(data.url);
        const set = new Set<string>([data.url]);
        for (const h of hrefs) {
          const abs = sameOrigin(base, h);
          if (abs) set.add(abs);
          if (set.size >= data.limit) break;
        }
        return Array.from(set).slice(0, data.limit);
      });
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
    const { withPage } = await import("@/lib/browserbase.server");
    try {
      const result = await withPage(async (page) => {
        const resp = await page.goto(data.url, { waitUntil: "domcontentloaded", timeout: 45000 });
        const status = resp?.status();
        const title = await page.title().catch(() => undefined);
        const hrefs: string[] = await page.$$eval("a[href]", (as) =>
          (as as HTMLAnchorElement[]).map((a) => a.href).filter(Boolean),
        );
        const base = new URL(data.url);
        const links = Array.from(
          new Set(hrefs.map((h) => sameOrigin(base, h)).filter((v): v is string => !!v)),
        ).slice(0, 50);
        const text = await page
          .evaluate(() => document.body?.innerText ?? "")
          .catch(() => "");
        let screenshot: string | undefined;
        if (data.withScreenshot) {
          const buf = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false });
          screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
        }
        return { title, status, links, markdownPreview: text.slice(0, 4000), screenshot };
      });
      return {
        ok: true as const,
        page: { url: data.url, ...result },
      };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
