import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys.functions";

export function ApiKeysCard() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => listApiKeys(),
  });

  const create = useMutation({
    mutationFn: (n: string) => createApiKey({ data: { name: n } }),
    onSuccess: (res) => {
      setFresh(res.key);
      setName("");
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Key created — copy it now, it is not shown again");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Key revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> API keys
        </CardTitle>
        <CardDescription>
          Let a build pipeline start automated test runs. Only a one-way hash is stored, so a key is
          shown once and can never be read back — revoke and create a new one if it is lost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name, e.g. GitHub Actions"
            className="max-w-xs"
          />
          <Button type="submit" disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating…" : "Create key"}
          </Button>
        </form>

        {fresh && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Copy this key now
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-xs">{fresh}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(fresh);
                  toast.success("Copied");
                }}
              >
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (keys ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No keys yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {(keys ?? []).map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {k.name}
                    {k.revoked_at && <Badge variant="secondary">Revoked</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <code>{k.prefix}…</code> · created {new Date(k.created_at).toLocaleDateString()}{" "}
                    · last used{" "}
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                  </div>
                </div>
                {!k.revoked_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revoke.mutate(k.id)}
                    disabled={revoke.isPending}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
