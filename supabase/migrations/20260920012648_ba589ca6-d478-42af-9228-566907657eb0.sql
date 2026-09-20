-- ============ BASELINE REBUILD (database was found empty) ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  theme_pref text NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
  IF LOWER(NEW.email) = 'rickybridges04@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('qa_run', 'agent_task')),
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own usage" ON public.usage_events;
CREATE POLICY "Users read own usage" ON public.usage_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "Users insert own usage" ON public.usage_events;
CREATE POLICY "Users insert own usage" ON public.usage_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS usage_events_user_id_idx ON public.usage_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','trialing','active','past_due','canceled','unpaid')),
  price_cents INTEGER,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;
CREATE POLICY "Users read own subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  base_url text,
  icon_url text,
  theme_color text DEFAULT '#7c3aed',
  bg_color text DEFAULT '#ffffff',
  short_desc text,
  long_desc text,
  category text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apps TO authenticated;
GRANT ALL ON public.apps TO service_role;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own apps read" ON public.apps;
CREATE POLICY "own apps read" ON public.apps FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "own apps insert" ON public.apps;
CREATE POLICY "own apps insert" ON public.apps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own apps update" ON public.apps;
CREATE POLICY "own apps update" ON public.apps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own apps delete" ON public.apps;
CREATE POLICY "own apps delete" ON public.apps FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS apps_updated ON public.apps;
CREATE TRIGGER apps_updated BEFORE UPDATE ON public.apps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS apps_user_id_idx ON public.apps(user_id);

CREATE TABLE IF NOT EXISTS public.app_store_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  assets jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, store)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_store_submissions TO authenticated;
GRANT ALL ON public.app_store_submissions TO service_role;
ALTER TABLE public.app_store_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own subs" ON public.app_store_submissions;
CREATE POLICY "own subs" ON public.app_store_submissions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS app_store_subs_updated ON public.app_store_submissions;
CREATE TRIGGER app_store_subs_updated BEFORE UPDATE ON public.app_store_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS app_store_subs_app_idx ON public.app_store_submissions(app_id);
CREATE INDEX IF NOT EXISTS app_store_subs_user_idx ON public.app_store_submissions(user_id);

CREATE TABLE IF NOT EXISTS public.app_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_tables TO authenticated;
GRANT ALL ON public.app_tables TO service_role;
ALTER TABLE public.app_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own app_tables" ON public.app_tables;
CREATE POLICY "own app_tables" ON public.app_tables FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS app_tables_app_idx ON public.app_tables(app_id);
CREATE INDEX IF NOT EXISTS app_tables_user_idx ON public.app_tables(user_id);

CREATE TABLE IF NOT EXISTS public.app_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.app_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_rows TO authenticated;
GRANT ALL ON public.app_rows TO service_role;
ALTER TABLE public.app_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own app_rows" ON public.app_rows;
CREATE POLICY "own app_rows" ON public.app_rows FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS app_rows_table_idx ON public.app_rows(table_id);
CREATE INDEX IF NOT EXISTS app_rows_user_idx ON public.app_rows(user_id);

CREATE TABLE IF NOT EXISTS public.app_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  form_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.app_form_submissions TO authenticated;
GRANT ALL ON public.app_form_submissions TO service_role;
ALTER TABLE public.app_form_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own form subs" ON public.app_form_submissions;
CREATE POLICY "read own form subs" ON public.app_form_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'))));
DROP POLICY IF EXISTS "update own form subs" ON public.app_form_submissions;
CREATE POLICY "update own form subs" ON public.app_form_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete own form subs" ON public.app_form_submissions;
CREATE POLICY "delete own form subs" ON public.app_form_submissions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS app_form_subs_app_idx ON public.app_form_submissions(app_id);

CREATE TABLE IF NOT EXISTS public.notification_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, endpoint)
);
GRANT SELECT, UPDATE, DELETE ON public.notification_subscribers TO authenticated;
GRANT ALL ON public.notification_subscribers TO service_role;
ALTER TABLE public.notification_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own subs" ON public.notification_subscribers;
CREATE POLICY "read own subs" ON public.notification_subscribers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND (a.user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'))));
CREATE INDEX IF NOT EXISTS notif_subs_app_idx ON public.notification_subscribers(app_id);

CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  url text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_campaigns TO authenticated;
GRANT ALL ON public.notification_campaigns TO service_role;
ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own campaigns" ON public.notification_campaigns;
CREATE POLICY "own campaigns" ON public.notification_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS notif_camp_app_idx ON public.notification_campaigns(app_id);
CREATE INDEX IF NOT EXISTS notif_camp_user_idx ON public.notification_campaigns(user_id);

-- ============ PHASE 1: PROJECTS ============
CREATE TABLE IF NOT EXISTS public.qa_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_url text NOT NULL,
  environment text NOT NULL DEFAULT 'staging' CHECK (environment IN ('staging','production')),
  username text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_projects TO authenticated;
GRANT ALL ON public.qa_projects TO service_role;
ALTER TABLE public.qa_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own qa_projects" ON public.qa_projects;
CREATE POLICY "own qa_projects" ON public.qa_projects FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS qa_projects_user_idx ON public.qa_projects(user_id, created_at DESC);
DROP TRIGGER IF EXISTS qa_projects_updated ON public.qa_projects;
CREATE TRIGGER qa_projects_updated BEFORE UPDATE ON public.qa_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ QA RUNS (baseline + evidence + project link) ============
CREATE TABLE IF NOT EXISTS public.qa_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  depth TEXT NOT NULL,
  personas TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running',
  score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.qa_runs
  ADD COLUMN IF NOT EXISTS progress_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_stage text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS verdict text,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pages_discovered integer,
  ADD COLUMN IF NOT EXISTS pages_scraped integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.qa_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'crawl',
  ADD COLUMN IF NOT EXISTS passed_count integer,
  ADD COLUMN IF NOT EXISTS failed_count integer;
DO $$ BEGIN
  ALTER TABLE public.qa_runs ADD CONSTRAINT qa_runs_kind_chk CHECK (kind IN ('crawl','automated'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_runs TO authenticated;
GRANT ALL ON public.qa_runs TO service_role;
ALTER TABLE public.qa_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own qa runs" ON public.qa_runs;
CREATE POLICY "Users read own qa runs" ON public.qa_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
DROP POLICY IF EXISTS "Users insert own qa runs" ON public.qa_runs;
CREATE POLICY "Users insert own qa runs" ON public.qa_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own qa runs" ON public.qa_runs;
CREATE POLICY "Users update own qa runs" ON public.qa_runs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own qa runs" ON public.qa_runs;
CREATE POLICY "Users delete own qa runs" ON public.qa_runs FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
CREATE INDEX IF NOT EXISTS qa_runs_user_id_idx ON public.qa_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qa_runs_project_idx ON public.qa_runs(project_id);
DROP TRIGGER IF EXISTS qa_runs_updated ON public.qa_runs;
CREATE TRIGGER qa_runs_updated BEFORE UPDATE ON public.qa_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.qa_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.qa_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  url text NOT NULL,
  title text,
  status integer,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  markdown_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_pages
  ADD COLUMN IF NOT EXISTS screenshot_url text,
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS truncated boolean NOT NULL DEFAULT false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_pages TO authenticated;
GRANT ALL ON public.qa_pages TO service_role;
ALTER TABLE public.qa_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own qa_pages" ON public.qa_pages;
CREATE POLICY "Users manage own qa_pages" ON public.qa_pages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own qa pages" ON public.qa_pages;
CREATE POLICY "Users delete own qa pages" ON public.qa_pages FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
CREATE INDEX IF NOT EXISTS qa_pages_run_id_idx ON public.qa_pages(run_id);
CREATE INDEX IF NOT EXISTS qa_pages_user_idx ON public.qa_pages(user_id);

CREATE TABLE IF NOT EXISTS public.qa_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.qa_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  persona_id text NOT NULL,
  page_url text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.6,
  title text NOT NULL,
  detail text NOT NULL,
  suggestion text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.qa_findings
  ADD COLUMN IF NOT EXISTS basis text NOT NULL DEFAULT 'inferred';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_findings TO authenticated;
GRANT ALL ON public.qa_findings TO service_role;
ALTER TABLE public.qa_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own qa_findings" ON public.qa_findings;
CREATE POLICY "Users manage own qa_findings" ON public.qa_findings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own qa findings" ON public.qa_findings;
CREATE POLICY "Users delete own qa findings" ON public.qa_findings FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
CREATE INDEX IF NOT EXISTS qa_findings_run_id_idx ON public.qa_findings(run_id);
CREATE INDEX IF NOT EXISTS qa_findings_user_idx ON public.qa_findings(user_id);

-- ============ SUITES / CASES ============
CREATE TABLE IF NOT EXISTS public.test_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.qa_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('auth','crud','security','ui','api','a11y','performance','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_suites TO authenticated;
GRANT ALL ON public.test_suites TO service_role;
ALTER TABLE public.test_suites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own test_suites" ON public.test_suites;
CREATE POLICY "own test_suites" ON public.test_suites FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS test_suites_project_idx ON public.test_suites(project_id);
CREATE INDEX IF NOT EXISTS test_suites_user_idx ON public.test_suites(user_id);
DROP TRIGGER IF EXISTS test_suites_updated ON public.test_suites;
CREATE TRIGGER test_suites_updated BEFORE UPDATE ON public.test_suites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suite_id uuid NOT NULL REFERENCES public.test_suites(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.qa_projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  expected text NOT NULL DEFAULT '',
  steps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by text NOT NULL DEFAULT 'human' CHECK (generated_by IN ('ai','human')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_cases TO authenticated;
GRANT ALL ON public.test_cases TO service_role;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own test_cases" ON public.test_cases;
CREATE POLICY "own test_cases" ON public.test_cases FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS test_cases_suite_idx ON public.test_cases(suite_id);
CREATE INDEX IF NOT EXISTS test_cases_project_idx ON public.test_cases(project_id);
CREATE INDEX IF NOT EXISTS test_cases_user_idx ON public.test_cases(user_id);
DROP TRIGGER IF EXISTS test_cases_updated ON public.test_cases;
CREATE TRIGGER test_cases_updated BEFORE UPDATE ON public.test_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ JOB QUEUE ============
CREATE TABLE IF NOT EXISTS public.qa_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.qa_runs(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','claimed','done','failed')),
  claimed_by text,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_jobs TO authenticated;
GRANT ALL ON public.qa_jobs TO service_role;
ALTER TABLE public.qa_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own qa_jobs" ON public.qa_jobs;
CREATE POLICY "own qa_jobs" ON public.qa_jobs FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS qa_jobs_status_idx ON public.qa_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS qa_jobs_run_idx ON public.qa_jobs(run_id);
CREATE INDEX IF NOT EXISTS qa_jobs_case_idx ON public.qa_jobs(case_id);
CREATE INDEX IF NOT EXISTS qa_jobs_user_idx ON public.qa_jobs(user_id);
DROP TRIGGER IF EXISTS qa_jobs_updated ON public.qa_jobs;
CREATE TRIGGER qa_jobs_updated BEFORE UPDATE ON public.qa_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTOMATED RESULTS ============
CREATE TABLE IF NOT EXISTS public.automated_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.qa_runs(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  job_id uuid NOT NULL UNIQUE REFERENCES public.qa_jobs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pass','fail','error')),
  duration_ms integer,
  failed_step_index integer,
  error_message text,
  console_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  network_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  axe_violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  web_vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  step_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  screenshot_path text,
  error_signature text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automated_results TO authenticated;
GRANT ALL ON public.automated_results TO service_role;
ALTER TABLE public.automated_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own automated_results" ON public.automated_results;
CREATE POLICY "own automated_results" ON public.automated_results FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS automated_results_run_idx ON public.automated_results(run_id);
CREATE INDEX IF NOT EXISTS automated_results_case_idx ON public.automated_results(case_id);
CREATE INDEX IF NOT EXISTS automated_results_user_idx ON public.automated_results(user_id);
CREATE INDEX IF NOT EXISTS automated_results_sig_idx ON public.automated_results(error_signature);

-- ============ ATOMIC JOB CLAIM ============
CREATE OR REPLACE FUNCTION public.claim_qa_job(p_worker text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.qa_jobs;
  v_case public.test_cases;
  v_project public.qa_projects;
  v_run public.qa_runs;
BEGIN
  -- Re-queue jobs whose worker went silent.
  UPDATE public.qa_jobs
     SET status = 'queued', claimed_by = NULL, claimed_at = NULL, heartbeat_at = NULL
   WHERE status = 'claimed'
     AND heartbeat_at < now() - interval '5 minutes'
     AND attempts < 3;

  UPDATE public.qa_jobs
     SET status = 'failed', error = 'worker lost'
   WHERE status = 'claimed'
     AND heartbeat_at < now() - interval '5 minutes'
     AND attempts >= 3;

  SELECT * INTO v_job
    FROM public.qa_jobs
   WHERE status = 'queued'
   ORDER BY created_at
     FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.qa_jobs
     SET status = 'claimed',
         claimed_by = p_worker,
         claimed_at = now(),
         heartbeat_at = now(),
         attempts = attempts + 1
   WHERE id = v_job.id;

  SELECT * INTO v_case FROM public.test_cases WHERE id = v_job.case_id;
  SELECT * INTO v_run FROM public.qa_runs WHERE id = v_job.run_id;
  SELECT * INTO v_project FROM public.qa_projects WHERE id = v_run.project_id;

  RETURN jsonb_build_object(
    'id', v_job.id,
    'base_url', COALESCE(v_project.base_url, v_run.target_url),
    'case', jsonb_build_object(
      'id', v_case.id,
      'code', v_case.code,
      'title', v_case.title,
      'steps', v_case.steps_json
    ),
    'credentials', CASE
      WHEN v_project.id IS NULL OR (v_project.username IS NULL AND v_project.password IS NULL) THEN NULL
      ELSE jsonb_build_object('username', v_project.username, 'password', v_project.password)
    END,
    'capture', jsonb_build_object('screenshot', true, 'axe', true, 'vitals', true)
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_qa_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_qa_job(text) TO service_role;