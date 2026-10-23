import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetPasswordCard() {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && pw !== confirm;
  const valid = pw.length >= 8 && pw === confirm;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser(
        current ? ({ password: pw, current_password: current } as never) : { password: pw },
      );
      if (error) throw error;
      toast.success("Password saved. You can now sign in with your email and this password.");
      setCurrent(""); setPw(""); setConfirm("");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't save password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Set a new password
        </CardTitle>
        <CardDescription>
          A backup way in if Google sign-in isn't available. Signed up with Google only? Leave
          "Current password" blank.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid max-w-sm gap-3">
          <div>
            <Label htmlFor="cur-pw">Current password (if you have one)</Label>
            <Input id="cur-pw" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="new-pw">New password (8+ characters)</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="confirm-pw">Confirm new password</Label>
            <Input id="confirm-pw" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} className="mt-1" />
            {mismatch && <p className="mt-1 text-xs text-destructive">Passwords don't match</p>}
          </div>
          <Button type="submit" disabled={!valid || busy} className="min-h-11">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
