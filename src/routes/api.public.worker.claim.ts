// POST /api/public/worker/claim — external Playwright worker claims one queued job.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireWorkerToken } from "@/lib/qa/worker.server";

const Body = z.object({ worker_id: z.string().min(1).max(200) });

export const Route = createFileRoute("/api/public/worker/claim")({
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
        const { data, error } = await supabaseAdmin.rpc("claim_qa_job", {
          p_worker: parsed.worker_id,
        });
        if (error) {
          console.error("claim_qa_job failed:", error.message);
          return new Response(`Claim failed: ${error.message}`, { status: 500 });
        }
        if (!data) return new Response(null, { status: 204 });
        return Response.json({ job: data });
      },
    },
  },
});
