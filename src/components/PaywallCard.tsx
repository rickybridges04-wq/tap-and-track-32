import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { useSubscription, FREE_RUN_LIMIT } from "@/lib/subscription";

export function PaywallCard({ what = "run" }: { what?: string }) {
  const { runsUsed } = useSubscription();
  return (
    <div className="rounded-lg border border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-cyan-500/10 p-6">
      <div className="flex items-center gap-2 text-fuchsia-300">
        <Lock className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Free trial used</span>
      </div>
      <h3 className="mt-2 text-xl font-semibold tracking-tight">
        You've used {runsUsed} of {FREE_RUN_LIMIT} free {what}s
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Upgrade to Pro for unlimited QA crawls and agent tasks.
      </p>
      <Link
        to="/upgrade"
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" /> Upgrade to Pro
      </Link>
    </div>
  );
}

export function TrialBadge() {
  const { active, runsRemaining } = useSubscription();
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
        <Sparkles className="h-3 w-3" /> Pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300">
      Trial · {runsRemaining} left
    </span>
  );
}
