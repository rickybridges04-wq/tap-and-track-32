## Root cause

The trash button and Clear all button both call server functions that run `supabase.from("qa_runs").delete()…` as the signed-in user. RLS on `qa_runs` has policies for INSERT, SELECT, and UPDATE only — there is **no DELETE policy**. Under RLS, a delete with no matching policy silently affects 0 rows and returns no error, so the mutation resolves successfully, the "All runs cleared" / "Run deleted" toast fires, the query refetches, and the same rows come back.

DB currently has 12 `qa_runs` rows for the signed-in user that survived every click.

`qa_pages` and `qa_findings` already cascade on `qa_runs.id`, so fixing `qa_runs` fixes both buttons.

## Changes

1. **Migration** — add DELETE policy on `qa_runs`:
   ```sql
   CREATE POLICY "Users delete own qa runs"
     ON public.qa_runs FOR DELETE
     TO authenticated
     USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
   ```
   (Mirrors the existing SELECT policy so an owner can also purge.)

2. **Data purge** — delete all existing rows from `qa_runs` (cascades to `qa_pages` and `qa_findings`) for user `2805d9cf-af87-4cd6-b113-6da5fae7a437`, clearing the tab as requested.

No frontend or server-function code changes needed — those are already correct once the policy exists.

## Verification

- Re-query `qa_runs` after the purge → 0 rows for that user.
- On the live QA tab, empty state renders; a new run then Trash / Clear all removes the row and it stays gone after refetch.
