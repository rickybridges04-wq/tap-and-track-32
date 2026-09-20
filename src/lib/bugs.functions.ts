// Synapse QA OS — bug tracker (authenticated server functions).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export const BUG_STATUSES = ["open", "in_progress", "resolved", "wontfix"] as const;
export const BUG_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type BugStatus = (typeof BUG_STATUSES)[number];
export type BugSeverity = (typeof BUG_SEVERITIES)[number];

export type Bug = {
  id: string;
  project_id: string | null;
  result_id: string | null;
  failure_analysis_id: string | null;
  title: string;
  severity: BugSeverity;
  status: BugStatus;
  assignee: string | null;
  steps_to_reproduce: Json;
  expected: string | null;
  actual: string | null;
  likely_cause: string | null;
  screenshot_path: string | null;
  github_issue_url: string | null;
  created_at: string;
  updated_at: string;
};


export type BugComment = {
  id: string;
  bug_id: string;
  body: string;
  created_at: string;
};

const CreateInput = z.object({
  project_id: z.string().uuid().nullable().optional(),
  result_id: z.string().uuid().nullable().optional(),
  failure_analysis_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300),
  severity: z.enum(BUG_SEVERITIES).default("medium"),
  assignee: z.string().max(200).nullable().optional(),
  steps_to_reproduce: z.array(z.string().max(500)).max(50).default([]),
  expected: z.string().max(4000).nullable().optional(),
  actual: z.string().max(4000).nullable().optional(),
  likely_cause: z.string().max(4000).nullable().optional(),
  screenshot_path: z.string().max(500).nullable().optional(),
});

export const createBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("bugs")
      .insert({
        user_id: context.userId,
        project_id: data.project_id ?? null,
        result_id: data.result_id ?? null,
        failure_analysis_id: data.failure_analysis_id ?? null,
        title: data.title,
        severity: data.severity,
        status: "open",
        assignee: data.assignee ?? null,
        steps_to_reproduce: data.steps_to_reproduce,
        expected: data.expected ?? null,
        actual: data.actual ?? null,
        likely_cause: data.likely_cause ?? null,
        screenshot_path: data.screenshot_path ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const listBugs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Bug[]> => {
    const { data, error } = await context.supabase
      .from("bugs")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Bug[];
  });

const IdInput = z.object({ id: z.string().uuid() });

export const getBug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [bugRes, commentsRes] = await Promise.all([
      supabase.from("bugs").select("*").eq("id", data.id).eq("user_id", userId).maybeSingle(),
      supabase
        .from("bug_comments")
        .select("id, bug_id, body, created_at")
        .eq("bug_id", data.id)
        .eq("user_id", userId)
        .order("created_at"),
    ]);
    if (bugRes.error) throw new Error(bugRes.error.message);
    if (!bugRes.data) return null;
    const bug = bugRes.data as unknown as Bug;

    let screenshotUrl: string | null = null;
    if (bug.screenshot_path) {
      const { data: signed } = await supabase.storage
        .from("qa-evidence")
        .createSignedUrl(bug.screenshot_path, 60 * 30);
      screenshotUrl = signed?.signedUrl ?? null;
    }
    return {
      bug,
      comments: (commentsRes.data ?? []) as unknown as BugComment[],
      screenshotUrl,
    };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(BUG_STATUSES).optional(),
  severity: z.enum(BUG_SEVERITIES).optional(),
  assignee: z.string().max(200).nullable().optional(),
  title: z.string().min(1).max(300).optional(),
});

export const updateBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("bugs")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bugs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addBugComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ bug_id: z.string().uuid(), body: z.string().min(1).max(5000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bug_comments").insert({
      bug_id: data.bug_id,
      user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- optional GitHub issue ----------------
export const openGithubIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bug_id: z.string().uuid(),
        repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Use owner/repo"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const token = process.env["GITHUB_TOKEN"];
    if (!token) {
      return {
        ok: false as const,
        skipped: true as const,
        message:
          "GitHub is not connected. Add a GITHUB_TOKEN in Project Settings → Secrets, then try again.",
      };
    }
    const { data: bug, error } = await context.supabase
      .from("bugs")
      .select("*")
      .eq("id", data.bug_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bug) throw new Error("Bug not found");

    const steps = Array.isArray(bug.steps_to_reproduce)
      ? (bug.steps_to_reproduce as unknown[]).map((s, i) => `${i + 1}. ${String(s)}`).join("\n")
      : "";
    const body = [
      `**Severity:** ${bug.severity}`,
      "",
      "### Steps to reproduce",
      steps || "_none recorded_",
      "",
      "### Expected",
      bug.expected ?? "_not recorded_",
      "",
      "### Actual",
      bug.actual ?? "_not recorded_",
      "",
      "### Likely cause (Suggestion — AI)",
      bug.likely_cause ?? "_no analysis_",
      "",
      "_Filed from Synapse QA OS._",
    ].join("\n");

    const res = await fetch(`https://api.github.com/repos/${data.repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "synapse-qa-os",
      },
      body: JSON.stringify({ title: bug.title, body }),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false as const,
        skipped: false as const,
        message: `GitHub refused the request (${res.status}): ${text.slice(0, 300)}`,
      };
    }
    const url = (JSON.parse(text) as { html_url?: string }).html_url ?? null;
    if (url) {
      await context.supabase
        .from("bugs")
        .update({ github_issue_url: url })
        .eq("id", data.bug_id)
        .eq("user_id", context.userId);
    }
    return { ok: true as const, skipped: false as const, url, message: "Issue created." };
  });
