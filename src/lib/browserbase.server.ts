// Browserbase driver — creates a remote Chromium session and drives it via Playwright.
// Server-only. Read env inside handlers.
import { chromium, type Browser, type Page } from "playwright-core";

type SessionInfo = { id: string; connectUrl: string };

async function createSession(apiKey: string, projectId: string): Promise<SessionInfo> {
  const res = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": apiKey,
    },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Browserbase createSession ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id: string; connectUrl?: string };
  const connectUrl =
    json.connectUrl ??
    `wss://connect.browserbase.com?apiKey=${encodeURIComponent(apiKey)}&sessionId=${encodeURIComponent(json.id)}`;
  return { id: json.id, connectUrl };
}

export async function withPage<T>(
  fn: (page: Page, ctx: { sessionId: string }) => Promise<T>,
): Promise<T> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is not configured");
  if (!projectId) throw new Error("BROWSERBASE_PROJECT_ID is not configured");

  const session = await createSession(apiKey, projectId);
  let browser: Browser | null = null;
  try {
    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    return await fn(page, { sessionId: session.id });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
