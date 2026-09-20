import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteMyAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";

export function DeleteAccountCard() {
  const del = useServerFn(deleteMyAccount);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const armed = phrase.trim() === "DELETE";

  async function run() {
    if (!armed || busy) return;
    setBusy(true);
    try {
      const res = await del({ data: { confirm: "DELETE" } });
      if ("error" in res) {
        toast.error(res.error);
        setBusy(false);
        return;
      }
      toast.success("Your account and all of its data have been deleted.");
      // Drop the now-orphaned token locally and leave the app.
      await supabase.auth.signOut().catch(() => {});
      if (typeof window !== "undefined") window.location.href = "/";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Account deletion failed");
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="h-4 w-4" /> Delete account
        </CardTitle>
        <CardDescription>
          Permanently deletes your account and everything in it — registered apps, QA runs, pages,
          findings, bugs, test projects, API keys, store submissions and saved screenshots. You are
          signed out immediately and this cannot be undone or recovered.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label htmlFor="delete-confirm" className="block text-sm font-medium">
          Type DELETE to confirm
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="delete-confirm"
            className="max-w-[200px] font-mono"
            placeholder="DELETE"
            autoComplete="off"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
          />
          <Button variant="destructive" disabled={!armed || busy} onClick={run}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {busy ? "Deleting…" : "Delete my account permanently"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
