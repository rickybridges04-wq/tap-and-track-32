import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Check, Sparkles, ArrowLeft, Crown, Loader2 } from "lucide-react";
import { useSubscription, useRefreshUsage } from "@/lib/subscription";
import { useAuth } from "@/hooks/useAuth";
import { FREE_RUN_LIMIT, formatPrice, savePlanIntent } from "@/lib/plan";
import {
  getPlans,
  startPlanCheckout,
  confirmPlanCheckout,
  openBillingPortal,
  type CatalogPlan,
} from "@/lib/billing.functions";

type Search = { plan?: string; session_id?: string };

export const Route = createFileRoute("/upgrade")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s.plan === "string" && /^[a-z0-9_-]{2,80}$/.test(s.plan) ? { plan: s.plan } : {}),
    ...(typeof s.session_id === "string" && /^cs_[A-Za-z0-9_]{8,250}$/.test(s.session_id)
      ? { session_id: s.session_id }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Upgrade · Walkthrough Wizard QAOS" },
      { name: "description", content: "Paid plans: unlimited QA crawls and AI agent tasks." },
      { property: "og:title", content: "Upgrade · Walkthrough Wizard QAOS" },
      {
        property: "og:description",
        content: "Paid plans: unlimited QA crawls and AI agent tasks.",
      },
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

type Interval = "month" | "year";

function Upgrade() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { active, runsUsed, isOwner } = useSubscription();
  const refreshUsage = useRefreshUsage();
  const search = Route.useSearch();
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const autoStarted = useRef(false);
  const confirmed = useRef(false);

  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => getPlans(), staleTime: 60_000 });
  const plans = (plansQ.data ?? []).filter((p) => (p.billing_interval ?? "month") === interval);
  const hasYearly = (plansQ.data ?? []).some((p) => p.billing_interval === "year");

  useEffect(() => {
    if (!loading && !user) {
      if (search.plan) savePlanIntent(search.plan);
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, user, navigate, search.plan]);

  // Back from Stripe: confirm the session (idempotent), then refresh plan state.
  useEffect(() => {
    if (!user || !search.session_id || confirmed.current) return;
    confirmed.current = true;
    setBusy("confirm");
    confirmPlanCheckout({ data: { sessionId: search.session_id } })
      .then((res) => {
        if ("error" in res) setMessage({ kind: "error", text: res.error });
        else
          setMessage({
            kind: "ok",
            text: "You're on a paid plan now. Unlimited runs are unlocked.",
          });
        refreshUsage();
        navigate({ to: "/upgrade", search: {}, replace: true });
      })
      .finally(() => setBusy(null));
  }, [user, search.session_id, refreshUsage, navigate]);

  async function choose(plan: CatalogPlan) {
    setMessage(null);
    setBusy(plan.plan_key);
    try {
      const res = await startPlanCheckout({
        data: { planKey: plan.plan_key, origin: window.location.origin },
      });
      if ("error" in res) {
        setMessage({ kind: "error", text: res.error });
        setBusy(null);
        return;
      }
      window.location.assign(res.url);
    } catch {
      setMessage({ kind: "error", text: "Checkout could not start. Please try again." });
      setBusy(null);
    }
  }

  async function manageBilling() {
    setBusy("portal");
    try {
      const res = await openBillingPortal({ data: { origin: window.location.origin } });
      if ("error" in res) setMessage({ kind: "error", text: res.error });
      else window.location.assign(res.url);
    } finally {
      setBusy(null);
    }
  }

  // Came from the landing page / sign-up with a plan picked: open that checkout once.
  useEffect(() => {
    if (!user || active || isOwner || !search.plan || autoStarted.current || !plansQ.data) return;
    const p = plansQ.data.find((x) => x.plan_key === search.plan);
    if (!p) return;
    autoStarted.current = true;
    void choose(p);
  }, [user, active, isOwner, search.plan, plansQ.data]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <Link
        to="/"
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Upgrade</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isOwner
          ? "You have owner access — unlimited runs, no charge."
          : active
            ? "Your paid plan is active — unlimited runs."
            : `You've used ${runsUsed} of ${FREE_RUN_LIMIT} free runs. Unlock unlimited.`}
      </p>

      {message && (
        <div
          role="status"
          className={`mt-4 rounded-md border p-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {isOwner && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
          <Crown className="h-4 w-4" /> Owner account — no subscription needed.
        </div>
      )}

      {active && !isOwner && (
        <button
          onClick={manageBilling}
          disabled={busy !== null}
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
        >
          {busy === "portal" && <Loader2 className="h-4 w-4 animate-spin" />} Manage billing
        </button>
      )}

      {hasYearly && (
        <div className="mt-6 inline-flex rounded-md border border-border p-1 text-xs">
          {(["month", "year"] as const).map((i) => (
            <button
              key={i}
              onClick={() => setInterval(i)}
              className={`rounded px-3 py-1 ${interval === i ? "bg-accent font-semibold" : "text-muted-foreground"}`}
            >
              {i === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Free
          </div>
          <div className="mt-2 text-3xl font-bold">$0</div>
          <div className="text-xs text-muted-foreground">{FREE_RUN_LIMIT} runs total</div>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Check className="h-4 w-4 text-emerald-400" /> {FREE_RUN_LIMIT} QA / agent runs
            </li>
            <li className="flex gap-2">
              <Check className="h-4 w-4 text-emerald-400" /> Full feature preview
            </li>
          </ul>
        </div>

        {plansQ.isLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
          </div>
        )}
        {plansQ.isError && (
          <div className="rounded-lg border border-red-500/40 bg-card p-6 text-sm text-red-300">
            Plans couldn't load. Refresh the page to try again.
          </div>
        )}

        {plans.map((p, i) => (
          <div
            key={p.plan_key}
            className={`relative rounded-lg border-2 p-6 ${
              i === 0
                ? "border-fuchsia-500/60 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-cyan-500/10 shadow-xl shadow-fuchsia-500/20"
                : "border-border bg-card"
            }`}
          >
            {i === 0 && (
              <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Recommended
              </div>
            )}
            <div className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
              {p.name}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold">{formatPrice(p.price_cents)}</span>
              <span className="text-sm text-muted-foreground">
                /{interval === "year" ? "year" : "month"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {p.included_credits > 0 ? `${p.included_credits.toLocaleString()} AI credits · ` : ""}
              Cancel anytime
            </div>
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
                <Sparkles className="mr-1 inline h-4 w-4" /> Paid plan active
              </button>
            ) : isOwner ? (
              <button
                disabled
                className="mt-6 w-full rounded-md bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-400"
              >
                <Crown className="mr-1 inline h-4 w-4" /> Owner · unlimited
              </button>
            ) : (
              <button
                onClick={() => choose(p)}
                disabled={busy !== null}
                className="mt-6 inline-flex w-full items-center justify-center gap-1 rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-90 disabled:opacity-60"
              >
                {busy === p.plan_key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Choose {p.name}
              </button>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
