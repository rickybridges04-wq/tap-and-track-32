## Fix `permission denied for function has_role`

RLS policies on the new tables (apps, app_tables, etc.) call `public.has_role(...)` to check the owner bypass. The function is `SECURITY DEFINER` but the `authenticated`/`anon` roles were never granted EXECUTE on it, so every policy evaluation throws — which is why `/apps` fails to load.

### Migration

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
```

That's the whole fix — one grant statement. No code changes needed; existing policies and functions stay as-is.

### Verify

After the migration runs, reload `/apps` — the list should load (empty state or existing apps) instead of throwing the permission error.
