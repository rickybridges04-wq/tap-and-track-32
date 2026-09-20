// Automated run reports: view data, CSV/PDF export, read-only share links.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Report } from "@/lib/qa/report.server";

const RunInput = z.object({ run_id: z.string().uuid() });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data, context }): Promise<Report | null> => {
    const { buildReport } = await import("@/lib/qa/report.server");
    // RLS scopes every read to the signed-in user.
    return await buildReport(context.supabase as never, data.run_id, { withSummary: true });
  });

export const exportReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    RunInput.extend({ format: z.enum(["csv", "pdf"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { buildReport, reportCsv, reportPdf } = await import("@/lib/qa/report.server");
    const report = await buildReport(context.supabase as never, data.run_id, { withSummary: true });
    if (!report) throw new Error("Run not found");
    const name = `qa-report-${report.run.short_id}`;
    if (data.format === "csv") {
      return { filename: `${name}.csv`, mime: "text/csv", base64: btoa(unescape(encodeURIComponent(reportCsv(report)))) };
    }
    const bytes = await reportPdf(report);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return { filename: `${name}.pdf`, mime: "application/pdf", base64: btoa(binary) };
  });

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    RunInput.extend({ days: z.number().int().min(1).max(90).default(7) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: run, error: runErr } = await supabase
      .from("qa_runs")
      .select("id")
      .eq("id", data.run_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (runErr) throw new Error(runErr.message);
    if (!run) throw new Error("Run not found");

    const raw = new Uint8Array(24);
    crypto.getRandomValues(raw);
    const token = Array.from(raw)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const expires = new Date(Date.now() + data.days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("qa_report_shares").insert({
      user_id: userId,
      run_id: data.run_id,
      token,
      expires_at: expires,
    });
    if (error) throw new Error(error.message);
    return { token, expires_at: expires, path: `/api/public/report/${token}` };
  });

export const listShareLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("qa_report_shares")
      .select("id, token, expires_at, created_at")
      .eq("run_id", data.run_id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("qa_report_shares")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
