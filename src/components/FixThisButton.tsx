import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { RunAgentDialog } from "@/components/RunAgentDialog";

export function FixThisButton({
  errorMessage,
  context,
  variant = "outline",
  size = "sm",
}: {
  errorMessage: string;
  context?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default";
}) {
  return (
    <RunAgentDialog
      defaultTitle={`Fix: ${errorMessage.slice(0, 80)}`}
      defaultDescription={context ?? errorMessage}
      defaultAgent="debug"
      source="error"
      trigger={
        <Button variant={variant} size={size}>
          <Wrench className="mr-1 h-4 w-4" /> Fix this
        </Button>
      }
    />
  );
}
