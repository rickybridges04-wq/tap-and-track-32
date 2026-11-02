import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Check, Sparkles, ArrowLeft, Crown } from "lucide-react";
import { useSubscription } from "@/lib/subscription";
import { useAuth } from "@/hooks/useAuth";
import { PRO_PRICE_KEY, savePlanIntent } from "@/lib/plan";
import { StripeEmbeddedCheckoutBlock, PaymentTestModeBanner } from "@/components/StripeEmbeddedCheckout";

export const Route = createFileRoute("/upgrade")({
  validateSearch: (s: Record<string, unknown>): { checkout?: 1 } =>
    s.checkout === 1 || s.checkout === "1" ? { checkout: 1 } : {},
  head: () => ({
    meta: [
      { title: "Upgrade to Pro · Walkthrough Wizard QAOS" },
      { name: "description", content: "Pro is $29/month: unlimited QA crawls and AI agent tasks." },
      { property: "og:title", content: "Upgrade to Pro · Walkthrough Wizard QAOS" },
      { property: "og:description", content: "Pro is $29/month: unlimited QA crawls and AI agent tasks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Upgrade,
});

const FEATURES = [
  "Unlimited autonomous QA crawls",
  "Unlimited AI agent tasks",
  "All 25 beta-tester personas",
  "Full 10-agent operations roster",
  "App store readiness scoring",
  "Priority AI routing",
];

function Upgrade() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { active, runsUsed, isOwner } = useSubscription();
  const search = Route.useSearch();
  const [showCheckout, setShowCheckout] = useState(search.checkout === 1);

  useEffect(() => {
    if (!loading && !user) {
      if (search.checkout === 1) savePlanIntent(PRO_PRICE_KEY);
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, user, navigate, search.checkout]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <PaymentTestModeBanner />
      <Link to="/" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Upgrade to Pro</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isOwner
          ? "You have owner access — unlimited runs, no charge."
          : `You've used ${runsUsed} free run${runsUsed === 1 ? "" : "s"}. Unlock unlimited.`}
      </p>

      {isOwner && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
          <Crown className="h-4 w-4" /> Owner account — no subscription needed.
        </div>
      )}

      {showCheckout && !isOwner && !active ? (
        <div className="mt-6 max-w-2xl">
          <StripeEmbeddedCheckoutBlock
            priceId={PRO_PRICE_KEY}
            returnUrl={`${window.location.origin}/upgrade?success=1`}
          />
          <button
            onClick={() => setShowCheckout(false)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to plans
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Free trial</div>
            <div className="mt-2 text-3xl font-bold">$0</div>
            <div className="text-xs text-muted-foreground">3 runs total</div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> 3 QA / agent runs</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-500" /> Full feature preview</li>
            </ul>
          </div>

          <div className="relative rounded-lg border-2 border-fuchsia-500/60 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-cyan-500/10 p-6 shadow-xl shadow-fuchsia-500/20">
            <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Recommended
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">Pro</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold">$29</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <div className="text-xs text-muted-foreground">Cancel anytime</div>
            <ul className="mt-4 space-y-2 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-fuchsia-400" /> {f}</li>
              ))}
            </ul>
            {active ? (
              <button disabled className="mt-6 w-full rounded-md bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-400">
                <Sparkles className="mr-1 inline h-4 w-4" /> Pro active
              </button>
            ) : isOwner ? (
              <button disabled className="mt-6 w-full rounded-md bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-400">
                <Crown className="mr-1 inline h-4 w-4" /> Owner · unlimited
              </button>
            ) : (
              <button
                onClick={() => setShowCheckout(true)}
                className="mt-6 w-full rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-90"
              >
                <Sparkles className="mr-1 inline h-4 w-4" /> Subscribe $29/mo
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
