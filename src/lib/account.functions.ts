// Permanent account deletion. Removes the user's rows, their stored evidence,
// and the auth user itself — which invalidates every existing session token,
// because the user no longer exists to authenticate against.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tables that carry user_id but are NOT covered by an ON DELETE CASCADE
// foreign key to auth.users, so they must be cleared explicitly first.
const MANUAL_CLEANUP = [
  "bug_comments",
  "bugs",
  "failure_analyses",
  "qa_findings",
  "qa_pages",
  "app_form_submissions",
  "notification_subscribers",
] as const;

export type DeleteAccountResult = { ok: true } | { error: string };

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ confirm: z.literal("DELETE") }).parse(input),
  )
  .handler(async ({ context }): Promise<DeleteAccountResult> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      // 1. Stored evidence files under this user's prefix.
      const { data: files } = await supabaseAdmin.storage
        .from("qa-evidence")
        .list(userId, { limit: 1000 });
      if (files?.length) {
        const paths: string[] = [];
        for (const entry of files) {
          // Evidence is stored as <user_id>/<run_id>/<job_id>.png
          const { data: inner } = await supabaseAdmin.storage
            .from("qa-evidence")
            .list(`${userId}/${entry.name}`, { limit: 1000 });
          if (inner?.length) {
            for (const f of inner) paths.push(`${userId}/${entry.name}/${f.name}`);
          } else {
            paths.push(`${userId}/${entry.name}`);
          }
        }
        if (paths.length) await supabaseAdmin.storage.from("qa-evidence").remove(paths);
      }

      // 2. Rows with no cascade path.
      for (const table of MANUAL_CLEANUP) {
        const { error } = await supabaseAdmin
          .from(table as never)
          .delete()
          .eq("user_id", userId);
        if (error) console.error(`deleteMyAccount: ${table}: ${error.message}`);
      }

      // 3. The auth user. Every other table cascades from here, and all
      //    existing access tokens stop resolving to a real user.
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) return { error: authError.message };

      return { ok: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Account deletion failed" };
    }
  });
