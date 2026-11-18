// Shows one visible, retryable error whenever the app fails to reach its backend
// (database reads, edge functions, server functions) instead of leaving an empty
// screen or a button that silently does nothing. Installed once from the app root.
type Notify = (message: string, opts: { id: string; description: string; action: { label: string; onClick: () => void } }) => unknown;
export type FailureKind = "read" | "action" | null;

let installed = false;

export function isLoadFailure(url: string, method: string, status: number | null): FailureKind {
  const m = method.toUpperCase();
  const read = m === "GET" || m === "HEAD";
  const rest = /\/rest\/v1\/(?!rpc\/)/.test(url);
  const fn = /\/functions\/v1\//.test(url) || /\/_serverFn\//.test(url);
  if (!rest && !fn) return null;
  if (rest && !read) return null; // database writes report their own errors
  const failed = status === null || status === 0 || status >= 500;
  if (!failed) return null;
  return rest || read ? "read" : "action";
}

export function isServerFnRead(url: string, method: string): boolean {
  return /\/_serverFn\//.test(url) && (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD");
}

/** True when a serialized server-function reply carries a thrown Error (not a redirect / not-found). */
export function serverFnFailed(body: string): boolean {
  return body.includes('"c":"$TSR/Error"');
}

export function installLoadErrorWatch(notify: Notify) {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  const original = window.fetch.bind(window);
  const report = (kind: Exclude<FailureKind, null>) =>
    notify(kind === "read" ? "Couldn't load your data" : "Couldn't reach the server", {
      id: "load-error",
      description: kind === "read" ? "Check your connection, then try again." : "That didn't finish. Check your connection, then try again.",
      action: { label: "Try again", onClick: () => window.location.reload() },
    });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    try {
      const res = await original(input, init);
      const kind = isLoadFailure(url, method, res.status);
      if (kind) report(kind);
      else if (isServerFnRead(url, method) && res.headers.get("x-tss-serialized") !== null) {
        // TanStack server functions answer 200 and serialize a thrown error into the body.
        void res.clone().text().then((t) => { if (serverFnFailed(t)) report("read"); }).catch(() => {});
      }
      return res;
    } catch (e) {
      const kind = isLoadFailure(url, method, null);
      if (kind && !(e instanceof DOMException && e.name === "AbortError")) report(kind);
      throw e;
    }
  };
}
