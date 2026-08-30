import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Offline fallback for the native shell + PWA: the app loads remotely,
 *  so a dropped connection must be explained rather than showing a blank webview. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t border-border bg-destructive px-4 py-2 text-center text-sm text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4" aria-hidden />
      You&apos;re offline — data can&apos;t load. Reconnect and it will resume automatically.
    </div>
  );
}
