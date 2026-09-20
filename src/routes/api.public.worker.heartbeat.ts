// POST /api/public/worker/heartbeat — keeps a claimed job from being re-queued.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireWorkerToken } from "@/lib/qa/worker.server";

const Body = z.object({
  job_id: z.string().uuid(),
  worker_id: z.string().min(1).max(200),
});

export const Route = createFileRoute("/api/public/worker/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireWorkerToken(request);
        if (unauthorized) return unauthorized;

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("qa_jobs")
          .update({ heartbeat_at: new Date().toISOString() })
          .eq("id", parsed.job_id)
          .eq("claimed_by", parsed.worker_id)
          .select("id");
        if (error) {
          console.error("heartbeat failed:", error.message);
          return new Response(`Heartbeat failed: ${error.message}`, { status: 500 });
        }
        if (!data || data.length === 0) {
          return new Response("Job not claimed by this worker", { status: 409 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
