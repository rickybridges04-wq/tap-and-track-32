import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { useSubscription, setSubscribed, resetUsage } from "@/lib/subscription";

export const Route = createFileRoute("/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade · Walkthrough Wizard QAOS" }] }),
  component: Upgrade,
});

const FEATURES = [
  "Unlimited autonomous QA crawls",
  "Unlimited AI agent tasks",
  "All 25 beta-tester personas",
  "Full 10-agent operations roster",
  "Fix-suggestion auto-apply",
  "Priority Anthropic + Gemini routing",
];

function Upgrade() {
  const { active, runsUsed } = useSubscription();
  return (
    <AppShell>
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Upgrade to Pro</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You've used {runsUsed} free run{runsUsed === 1 ? "" : "s"}. Unlock unlimited.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Free trial</div>
          <div className="mt-2 text-3xl font-bold">$0</div>
          <div className="text-xs text-muted-foreground">2 runs total</div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> 2 QA / agent runs</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> Full feature preview</li>
          </ul>
        </div>

        <div className="relative rounded-lg border-2 border-fuchsia-500/60 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-cyan-500/10 p-6 shadow-xl shadow-fuchsia-500/20">
          <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Recommended
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">Pro</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold">$19</span>
            <span className="text-sm text-muted-foreground">/month</span>
          </div>
          <div className="text-xs text-muted-foreground">Cancel anytime</div>
          <ul className="mt-4 space-y-2 text-sm">
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="h-4 w-4 text-fuchsia-400" /> {f}
              </li>
            ))}
          </ul>
          {active ? (
            <button
              disabled
              className="mt-6 w-full rounded-md bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-400"
            >
              <Sparkles className="mr-1 inline h-4 w-4" /> Pro active
            </button>
          ) : (
            <button
              onClick={() => {
                // Stripe Checkout placeholder — wires up when Stripe is enabled.
                // For now, local activation so the gate clears for testing.
                setSubscribed(true);
                window.alert("Pro activated locally. Stripe Checkout will replace this when the live key is wired in.");
              }}
              className="mt-6 w-full rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-90"
            >
              <Sparkles className="mr-1 inline h-4 w-4" /> Subscribe $19/mo
            </button>
          )}
          {active && (
            <button
              onClick={() => {
                setSubscribed(false);
                resetUsage();
              }}
              className="mt-2 w-full rounded-md border border-input px-4 py-2 text-xs text-muted-foreground hover:bg-accent"
            >
              Reset to trial (dev)
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
