import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FREE_RUN_LIMIT } from "@/lib/plan";

export { FREE_RUN_LIMIT };

export type UsageState = {
  runsUsed: number;
  runsRemaining: number;
  isOwner: boolean;
  isSubscribed: boolean;
  canRun: boolean;
  email: string | null;
};

// Read-only. Runs are charged inside createRun / planAgentTask on the server.
export const getUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsageState> => {
    const { getPlan, canStartRun } = await import("@/lib/entitlements.server");
    const [plan, userRes] = await Promise.all([getPlan(context.userId), context.supabase.auth.getUser()]);
    return {
      runsUsed: plan.runsUsed,
      runsRemaining: Math.max(0, FREE_RUN_LIMIT - plan.runsUsed),
      isOwner: plan.isOwner,
      isSubscribed: plan.isSubscribed,
      canRun: canStartRun(plan),
      email: userRes.data.user?.email ?? null,
    };
  });
