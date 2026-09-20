// GET /api/public/report/<token>?format=json|csv|pdf
// Read-only, expiring share link for one automated run report. No session.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/report/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = params.token;
        if (!token || !/^[0-9a-f]{20,64}$/.test(token)) {
          return new Response("Invalid link", { status: 404 });
        }
        const format = new URL(request.url).searchParams.get("format") ?? "json";
        if (!["json", "csv", "pdf"].includes(format)) {
          return new Response("Unsupported format", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: share } = await supabaseAdmin
          .from("qa_report_shares")
          .select("run_id, expires_at")
          .eq("token", token)
          .maybeSingle();
        if (!share) return new Response("Link not found", { status: 404 });
        if (new Date(share.expires_at).getTime() < Date.now()) {
          return new Response("This share link has expired", { status: 410 });
        }

        const { buildReport, reportCsv, reportPdf } = await import("@/lib/qa/report.server");
        const report = await buildReport(supabaseAdmin as never, share.run_id, { withSummary: false });
        if (!report) return new Response("Run not found", { status: 404 });

        if (format === "csv") {
          return new Response(reportCsv(report), {
            headers: {
              "content-type": "text/csv; charset=utf-8",
              "content-disposition": `attachment; filename="qa-report-${report.run.short_id}.csv"`,
              "cache-control": "no-store",
            },
          });
        }
        if (format === "pdf") {
          const bytes = await reportPdf(report);
          return new Response(bytes as unknown as BodyInit, {
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `inline; filename="qa-report-${report.run.short_id}.pdf"`,
              "cache-control": "no-store",
            },
          });
        }
        return Response.json(report, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
