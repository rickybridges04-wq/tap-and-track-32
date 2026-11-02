import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { takePlanIntent } from "@/lib/plan";

/** After sign-up / Google sign-in, send a visitor who picked Pro straight to checkout — once. */
export function PlanIntentRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading || !user) return;
    if (takePlanIntent()) navigate({ to: "/upgrade", search: { checkout: 1 }, replace: true });
  }, [loading, user, navigate]);
  return null;
}
