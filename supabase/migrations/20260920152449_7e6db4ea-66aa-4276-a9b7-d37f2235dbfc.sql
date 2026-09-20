ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY[
    'inactive'::text,
    'trialing'::text,
    'active'::text,
    'past_due'::text,
    'canceled'::text,
    'unpaid'::text,
    'incomplete'::text,
    'incomplete_expired'::text,
    'paused'::text
  ]));