// Create / list / revoke public API keys. Only a SHA-256 hash is stored.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/api-keys";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApiKeyRow[]> => {
    const { data, error } = await context.supabase
      .from("api_keys")
      .select("id, name, prefix, last_used_at, created_at, revoked_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const key = generateApiKey();
    const { data: row, error } = await context.supabase
      .from("api_keys")
      .insert({
        user_id: context.userId,
        name: data.name,
        key_hash: await hashApiKey(key),
        prefix: keyPrefix(key),
      })
      .select("id, name, prefix, last_used_at, created_at, revoked_at")
      .single();
    if (error) throw new Error(error.message);
    // The plaintext key is returned exactly once and never stored.
    return { row: row as ApiKeyRow, key };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
