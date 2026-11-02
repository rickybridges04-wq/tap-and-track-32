import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Called only by the database (pg_net) to advance a queued QA run.
// Authenticated by a server-only secret stored in a table no client can read.
export const Route = createFileRoute("/api/public/qa/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const presented = request.headers.get("x-qa-tick-secret") ?? "";
        const parsed = z.object({ run_id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!presented || !parsed.success) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin.from("qa_engine_config").select("tick_secret").eq("id", 1).single();
        const expected = cfg?.tick_secret ?? "";
        let diff = presented.length ^ expected.length;
        for (let i = 0; i < Math.max(presented.length, expected.length); i++) {
          diff |= (presented.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
        }
        if (!expected || diff !== 0) return new Response("Unauthorized", { status: 401 });

        const { advanceRun, wakeRun } = await import("@/lib/qa/engine.server");
        const more = await advanceRun(parsed.data.run_id);
        if (more) await wakeRun(parsed.data.run_id);
        return Response.json({ ok: true, more });
      },
    },
  },
});
