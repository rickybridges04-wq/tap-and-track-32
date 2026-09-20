// Same contract as /api/v1/runs/:id, under the /api/public prefix.
import { createFileRoute } from "@tanstack/react-router";
import { handleGetRun } from "@/lib/qa/api-v1.server";

export const Route = createFileRoute("/api/public/v1/runs/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handleGetRun(request, params.id),
    },
  },
});
