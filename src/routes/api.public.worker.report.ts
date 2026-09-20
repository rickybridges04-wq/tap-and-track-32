// POST /api/public/worker/report — external Playwright worker reports one job result.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireWorkerToken } from "@/lib/qa/worker.server";

const CAP = 200;
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;

const Body = z.object({
  job_id: z.string().uuid(),
  worker_id: z.string().min(1).max(200),
  status: z.enum(["pass", "fail", "error"]),
  duration_ms: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  failed_step_index: z.number().int().min(0).nullable(),
  error_message: z.string().max(5000).nullable(),
  console_errors: z.array(z.string().max(2000)).max(CAP).default([]),
  network_failures: z
    .array(
      z.object({
        url: z.string().max(2000),
        status: z.number().int().nullable(),
        method: z.string().max(20),
        failure: z.string().max(1000).nullable(),
      }),
    )
    .max(CAP)
    .default([]),
  axe_violations: z
    .array(
      z.object({
        id: z.string().max(200),
        impact: z.string().max(40).nullable(),
        help: z.string().max(1000),
        nodes: z.number().int().min(0),
      }),
    )
    .max(CAP)
    .default([]),
  web_vitals: z
    .object({
      lcp_ms: z.number().nullable().default(null),
      cls: z.number().nullable().default(null),
      ttfb_ms: z.number().nullable().default(null),
      fcp_ms: z.number().nullable().default(null),
    })
    .default({ lcp_ms: null, cls: null, ttfb_ms: null, fcp_ms: null }),
  step_log: z
    .array(
      z.object({
        index: z.number().int().min(0),
        action: z.string().max(60),
        ok: z.boolean(),
        ms: z.number().int().min(0),
        error: z.string().max(2000).nullable(),
      }),
    )
    .max(CAP)
    .default([]),
  screenshot_png_base64: z.string().nullable().default(null),
});

type Report = z.infer<typeof Body>;

/** sha256 of the normalized error text + the failing step's selector. */
async function errorSignature(report: Report, selector: string | null): Promise<string | null> {
  if (report.status === "pass") return null;
  const normalized = (report.error_message ?? "")
    .toLowerCase()
    .replace(/0x[0-9a-f]+/g, "<hex>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, "<uuid>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
  const input = `${normalized}|${selector ?? ""}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

type AxeViolation = Report["axe_violations"][number];
type Vitals = Report["web_vitals"];

type FindingInsert = {
  run_id: string;
  user_id: string;
  persona_id: string;
  page_url: string;
  category: "functional" | "accessibility" | "performance";
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  title: string;
  detail: string;
  suggestion: string | null;
  basis: "observed";
};

function axeSeverity(impact: string | null): "high" | "medium" | "low" {
  if (impact === "critical" || impact === "serious") return "high";
  if (impact === "moderate") return "medium";
  return "low";
}

const PENALTY = { critical: 10, high: 6, medium: 3, low: 1 } as const;

function verdictFor(score: number): "ready" | "minor" | "major" | "blocked" {
  if (score >= 90) return "ready";
  if (score >= 75) return "minor";
  if (score >= 50) return "major";
  return "blocked";
}

function vitalsFindings(runId: string, userId: string, url: string, v: Vitals): FindingInsert[] {
  const out: FindingInsert[] = [];
  const add = (severity: "high" | "medium", title: string, detail: string, suggestion: string) =>
    out.push({
      run_id: runId,
      user_id: userId,
      persona_id: "measurement",
      page_url: url,
      category: "performance",
      severity,
      confidence: 1,
      title,
      detail,
      suggestion,
      basis: "observed",
    });
  if (v.lcp_ms != null && v.lcp_ms > 2500)
    add(
      v.lcp_ms > 4000 ? "high" : "medium",
      `Largest Contentful Paint ${(v.lcp_ms / 1000).toFixed(1)}s`,
      `Measured LCP in a real browser was ${Math.round(v.lcp_ms)}ms (good is under 2500ms).`,
      "Reduce the largest above-the-fold image or text block's load cost.",
    );
  if (v.cls != null && v.cls > 0.1)
    add(
      v.cls > 0.25 ? "high" : "medium",
      `Layout shift ${v.cls.toFixed(3)}`,
      `Measured Cumulative Layout Shift was ${v.cls.toFixed(3)} (good is under 0.1).`,
      "Reserve space for images, ads and late-loading content.",
    );
  if (v.ttfb_ms != null && v.ttfb_ms > 1800)
    add(
      "medium",
      `Time to first byte ${(v.ttfb_ms / 1000).toFixed(1)}s`,
      `Measured TTFB was ${Math.round(v.ttfb_ms)}ms (good is under 800ms).`,
      "Check server response time and upstream calls for this route.",
    );
  return out;
}

export const Route = createFileRoute("/api/public/worker/report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireWorkerToken(request);
        if (unauthorized) return unauthorized;

        let report: Report;
        try {
          report = Body.parse(await request.json());
        } catch (e) {
          return new Response(`Invalid body: ${e instanceof Error ? e.message : "parse error"}`, {
            status: 400,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: job, error: jobErr } = await supabaseAdmin
          .from("qa_jobs")
          .select("id, user_id, run_id, case_id, claimed_by, status")
          .eq("id", report.job_id)
          .maybeSingle();
        if (jobErr) return new Response(jobErr.message, { status: 500 });
        if (!job) return new Response("Job not found", { status: 404 });
        if (job.claimed_by !== report.worker_id) {
          return new Response("Job not claimed by this worker", { status: 409 });
        }

        // Screenshot → private bucket at <user_id>/<run_id>/<job_id>.png
        let screenshotPath: string | null = null;
        if (report.screenshot_png_base64) {
          let bytes: Uint8Array;
          try {
            bytes = base64ToBytes(report.screenshot_png_base64);
          } catch {
            return new Response("Invalid screenshot encoding", { status: 400 });
          }
          if (bytes.byteLength > MAX_SCREENSHOT_BYTES) {
            return new Response("Screenshot exceeds 3 MB", { status: 400 });
          }
          const path = `${job.user_id}/${job.run_id}/${job.id}.png`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("qa-evidence")
            .upload(path, bytes, { contentType: "image/png", upsert: true });
          if (upErr) console.error("evidence upload failed:", upErr.message);
          else screenshotPath = path;
        }

        // The failing step's selector (for the signature) and the case metadata.
        const { data: testCase } = await supabaseAdmin
          .from("test_cases")
          .select("code, title, steps_json")
          .eq("id", job.case_id)
          .maybeSingle();
        const steps = Array.isArray(testCase?.steps_json) ? (testCase!.steps_json as unknown[]) : [];
        let failedSelector: string | null = null;
        if (report.failed_step_index != null) {
          const step = steps[report.failed_step_index] as { selector?: string } | undefined;
          failedSelector = step?.selector ?? null;
        }

        const signature = await errorSignature(report, failedSelector);

        const { data: resultRow, error: resErr } = await supabaseAdmin
          .from("automated_results")
          .upsert(
            {
              user_id: job.user_id,
              run_id: job.run_id,
              case_id: job.case_id,
              job_id: job.id,
              status: report.status,
              duration_ms: report.duration_ms,
              failed_step_index: report.failed_step_index,
              error_message: report.error_message,
              console_errors: report.console_errors,
              network_failures: report.network_failures,
              axe_violations: report.axe_violations,
              web_vitals: report.web_vitals,
              step_log: report.step_log,
              screenshot_path: screenshotPath,
              error_signature: signature,
            },
            { onConflict: "job_id" },
          )
          .select("id")
          .single();
        if (resErr) {
          console.error("result insert failed:", resErr.message);
          return new Response(resErr.message, { status: 500 });
        }

        // ---- AI failure analyst -------------------------------------------
        // Playwright already decided the verdict. 'error' results are
        // infrastructure problems, never analysed. One analysis per signature.
        const { data: runRow } = await supabaseAdmin
          .from("qa_runs")
          .select("project_id, warnings")
          .eq("id", job.run_id)
          .maybeSingle();

        if (report.status === "fail" && signature) {
          const { analyseFailure } = await import("@/lib/qa/failure-analysis.server");
          const { data: projectUrl } = await supabaseAdmin
            .from("qa_projects")
            .select("base_url")
            .eq("id", runRow?.project_id ?? "")
            .maybeSingle();
          const outcome = await analyseFailure({
            admin: supabaseAdmin as never,
            userId: job.user_id,
            projectId: runRow?.project_id ?? null,
            resultId: resultRow?.id ?? null,
            signature,
            evidence: {
              case_code: testCase?.code ?? "",
              case_title: testCase?.title ?? "",
              steps,
              failed_step_index: report.failed_step_index,
              error_message: report.error_message,
              console_errors: report.console_errors,
              network_failures: report.network_failures,
              axe_violations: report.axe_violations,
              url: projectUrl?.base_url ?? "",
            },
          });
          if (outcome.warning) {
            const existing = Array.isArray(runRow?.warnings) ? (runRow!.warnings as string[]) : [];
            await supabaseAdmin
              .from("qa_runs")
              .update({ warnings: [...existing, outcome.warning] })
              .eq("id", job.run_id);
          }
        }


        await supabaseAdmin
          .from("qa_jobs")
          .update({
            status: report.status === "error" ? "failed" : "done",
            error: report.status === "pass" ? null : report.error_message,
            heartbeat_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        // Run complete? Then score it from the real results.
        const { count: outstanding } = await supabaseAdmin
          .from("qa_jobs")
          .select("id", { count: "exact", head: true })
          .eq("run_id", job.run_id)
          .in("status", ["queued", "claimed"]);

        if ((outstanding ?? 0) === 0) {
          const { data: results } = await supabaseAdmin
            .from("automated_results")
            .select("status, axe_violations, web_vitals, error_message, case_id, failed_step_index")
            .eq("run_id", job.run_id);
          const rows = results ?? [];
          const total = Math.max(1, rows.length);
          const passed = rows.filter((r) => r.status === "pass").length;
          const failed = rows.length - passed;

          const { data: run } = await supabaseAdmin
            .from("qa_runs")
            .select("target_url")
            .eq("id", job.run_id)
            .maybeSingle();
          const url = run?.target_url ?? "";

          const findings: FindingInsert[] = [];
          for (const r of rows) {
            if (r.status !== "pass") {
              findings.push({
                run_id: job.run_id,
                user_id: job.user_id,
                persona_id: "automated",
                page_url: url,
                category: "functional",
                severity: r.status === "error" ? "critical" : "high",
                confidence: 1,
                title:
                  r.status === "error"
                    ? "Test case errored before completing"
                    : `Test case failed at step ${r.failed_step_index ?? 0}`,
                detail: r.error_message ?? "No error message reported.",
                suggestion: "Reproduce the failing step in a browser and fix the underlying flow.",
                basis: "observed",
              });
            }
            const seen = new Set<string>();
            const axe = (r.axe_violations ?? []) as unknown as AxeViolation[];
            for (const v of Array.isArray(axe) ? axe : []) {
              if (seen.has(v.id)) continue;
              seen.add(v.id);
              findings.push({
                run_id: job.run_id,
                user_id: job.user_id,
                persona_id: "axe",
                page_url: url,
                category: "accessibility",
                severity: axeSeverity(v.impact ?? null),
                confidence: 1,
                title: `${v.id} (${v.nodes} element${v.nodes === 1 ? "" : "s"})`,
                detail: v.help,
                suggestion: "Fix the flagged elements so assistive technology can use them.",
                basis: "observed",
              });
            }
            findings.push(
              ...vitalsFindings(job.run_id, job.user_id, url, r.web_vitals as unknown as Vitals),
            );
          }

          if (findings.length) {
            const { error: fErr } = await supabaseAdmin.from("qa_findings").insert(findings);
            if (fErr) console.error("findings insert failed:", fErr.message);
          }

          const functionalPenalty = Math.round((failed / total) * 50);
          const a11yPenalty = Math.min(
            25,
            findings
              .filter((f) => f.category === "accessibility")
              .reduce((sum, f) => sum + PENALTY[f.severity], 0),
          );
          const perfPenalty = Math.min(
            25,
            findings
              .filter((f) => f.category === "performance")
              .reduce((sum, f) => sum + PENALTY[f.severity], 0),
          );
          const score = Math.max(0, 100 - functionalPenalty - a11yPenalty - perfPenalty);

          await supabaseAdmin
            .from("qa_runs")
            .update({
              status: "completed",
              progress_pct: 100,
              progress_stage: "Complete",
              score,
              verdict: verdictFor(score),
              passed_count: passed,
              failed_count: failed,
              completed_at: new Date().toISOString(),
            })
            .eq("id", job.run_id);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
