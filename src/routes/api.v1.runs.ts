import { createFileRoute } from "@tanstack/react-router";
import { handleCreateRun } from "@/lib/qa/api-v1.server";

export const Route = createFileRoute("/api/v1/runs")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCreateRun(request),
    },
  },
});
