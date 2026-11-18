import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { errorToastQueryCache } from "@/lib/query-errors";

export const getRouter = () => {
  const queryClient = new QueryClient({ queryCache: errorToastQueryCache() });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
