import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { takePlanIntent } from "@/lib/plan";

/** After sign-up / Google sign-in, send a visitor who picked a plan straight to checkout — once. */
export function PlanIntentRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading || !user) return;
    const plan = takePlanIntent();
    if (plan) navigate({ to: "/upgrade", search: { plan }, replace: true });
  }, [loading, user, navigate]);
  return null;
}
