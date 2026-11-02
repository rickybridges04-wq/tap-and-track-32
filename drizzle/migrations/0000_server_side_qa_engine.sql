CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.qa_runs
  ADD COLUMN IF NOT EXISTS job_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS wake_url text,
  ADD COLUMN IF NOT EXISTS usage_event_id uuid;

CREATE TABLE IF NOT EXISTS public.qa_engine_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tick_secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
REVOKE ALL ON public.qa_engine_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.qa_engine_config TO service_role;
ALTER TABLE public.qa_engine_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.qa_engine_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.qa_wake(p_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_url text; v_secret text;
BEGIN
  SELECT wake_url INTO v_url FROM public.qa_runs
   WHERE id = p_run_id AND status NOT IN ('completed','failed');
  IF v_url IS NULL THEN RETURN; END IF;
  SELECT tick_secret INTO v_secret FROM public.qa_engine_config WHERE id = 1;
  PERFORM net.http_post(
    url := v_url || '/api/public/qa/tick',
    headers := jsonb_build_object('Content-Type','application/json','x-qa-tick-secret', v_secret),
    body := jsonb_build_object('run_id', p_run_id),
    timeout_milliseconds := 120000
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.qa_wake(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qa_wake(uuid) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS usage_events_ref_uniq
  ON public.usage_events (user_id, kind, (meta->>'ref')) WHERE meta ? 'ref';

-- Owner status now comes only from existing user_roles rows; no email rule.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;