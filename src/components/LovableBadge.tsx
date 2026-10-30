import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function LovableBadge({ className }: { className?: string }) {
  return (
    <a
      href="https://lovable.dev/invite/680BELV"
      target="_blank"
      rel="noopener"
      aria-label="Built with Lovable (referral link, opens in new tab)"
      title="Build your own app with Lovable. You get 10 bonus credits; I earn credits if you upgrade."
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Heart className="h-3 w-3" />
      Built with Lovable
    </a>
  );
}
