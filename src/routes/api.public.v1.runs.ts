// Same contract as /api/v1/runs, under the /api/public prefix so external CI
// callers reach it even when the published site is behind Lovable auth.
import { createFileRoute } from "@tanstack/react-router";
import { handleCreateRun } from "@/lib/qa/api-v1.server";

export const Route = createFileRoute("/api/public/v1/runs")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCreateRun(request),
    },
  },
});
