import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onDelete: () => void;
  confirm?: string;
  label?: string;
  className?: string;
  size?: "sm" | "icon";
};

export function TrashButton({
  onDelete,
  confirm = "Delete this item? This cannot be undone.",
  label = "Delete",
  className,
  size = "icon",
}: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      aria-label={label}
      title={label}
      className={cn(
        "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        size === "icon" && "h-8 w-8",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm(confirm)) onDelete();
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
