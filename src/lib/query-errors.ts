import { QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";

/** A QueryCache that turns any failed data load into one visible, retryable error toast. */
export function errorToastQueryCache(): QueryCache {
  const cache: QueryCache = new QueryCache({
    onError: (error) => {
      if (typeof window === "undefined") return;
      const msg = error instanceof Error ? error.message : String(error ?? "");
      if (/unauthori[sz]ed|not signed in|jwt/i.test(msg)) return; // sign-in flows handle these
      toast.error("Couldn't load your data", {
        id: "load-error",
        description: "Check your connection, then try again.",
        action: { label: "Try again", onClick: () => void cache.getAll().filter((q) => q.state.status === "error").forEach((q) => void q.fetch()) },
      });
    },
  });
  return cache;
}
