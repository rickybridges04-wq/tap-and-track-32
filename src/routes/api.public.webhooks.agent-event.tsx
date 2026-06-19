// Public webhook endpoint for external agent triggers.
// NOTE: HMAC verification is a no-op while Lovable Cloud is disabled.
// When Cloud is enabled, switch to TESTER_WEBHOOK_SECRET + timing-safe compare.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  source: z.string().default("external"),
  type: z.string().default("event"),
  title: z.string().min(1),
  description: z.string().default(""),
  agentType: z
    .enum(["debug", "research", "ceo", "cfo", "marketing", "architect", "pm"])
    .optional(),
  priority: z.enum(["low", "med", "high"]).optional(),
});

export const Route = createFileRoute("/api/public/webhooks/agent-event")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          info: "POST { source, type, title, description, agentType?, priority? }",
        }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = Body.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: parsed.error.flatten() },
            { status: 400 },
          );
        }
        // TODO once Cloud is on: insert into agent_tasks via service role.
        // For now we return the queue payload; the frontend's webhook
        // listener (out of scope without server push) would enqueue it.
        return Response.json({
          ok: true,
          accepted: parsed.data,
          note: "Webhook payload accepted. Without Cloud + realtime, this is logged but not enqueued client-side. Add Cloud to wire end-to-end.",
        });
      },
    },
  },
});
