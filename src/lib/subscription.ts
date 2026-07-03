// Client hook: subscription/usage state fetched from server (with owner bypass).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getUsage, FREE_RUN_LIMIT as SERVER_LIMIT } from "@/lib/subscription.functions";

export const FREE_RUN_LIMIT = SERVER_LIMIT;

export type SubState = {
  active: boolean;
  runsUsed: number;
  runsRemaining: number;
  canRun: boolean;
  isOwner: boolean;
  email: string | null;
  loading: boolean;
};

export function useSubscription(): SubState {
  const { user, loading: authLoading } = useAuth();
  const q = useQuery({
    queryKey: ["usage", user?.id],
    queryFn: () => getUsage(),
    enabled: !!user,
    staleTime: 10_000,
  });

  if (!user) {
    return {
      active: false,
      runsUsed: 0,
      runsRemaining: FREE_RUN_LIMIT,
      canRun: false,
      isOwner: false,
      email: null,
      loading: authLoading,
    };
  }

  const d = q.data;
  return {
    active: !!d?.isSubscribed,
    runsUsed: d?.runsUsed ?? 0,
    runsRemaining: d?.runsRemaining ?? FREE_RUN_LIMIT,
    canRun: d?.canRun ?? false,
    isOwner: !!d?.isOwner,
    email: d?.email ?? user.email ?? null,
    loading: authLoading || q.isLoading,
  };
}

export function useRefreshUsage() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["usage"] });
}
