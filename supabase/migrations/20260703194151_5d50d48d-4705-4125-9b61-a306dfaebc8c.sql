
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS theme_pref text NOT NULL DEFAULT 'system';

-- apps
CREATE TABLE public.apps (
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
CREATE POLICY "own apps read" ON public.apps FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'owner'));
CREATE POLICY "own apps insert" ON public.apps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own apps update" ON public.apps FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own apps delete" ON public.apps FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER apps_updated BEFORE UPDATE ON public.apps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- app store submissions
CREATE TABLE public.app_store_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store text NOT NULL, -- 'pwa' | 'apple' | 'google'
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
CREATE POLICY "own subs" ON public.app_store_submissions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER app_store_subs_updated BEFORE UPDATE ON public.app_store_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- app_tables (data manager)
CREATE TABLE public.app_tables (
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
CREATE POLICY "own app_tables" ON public.app_tables FOR ALL TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.app_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.app_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_rows TO authenticated;
GRANT ALL ON public.app_rows TO service_role;
ALTER TABLE public.app_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own app_rows" ON public.app_rows FOR ALL TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);

-- form submissions inbox (external POSTs)
CREATE TABLE public.app_form_submissions (
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
CREATE POLICY "read own form subs" ON public.app_form_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND (a.user_id = auth.uid() OR has_role(auth.uid(), 'owner')))
  );
CREATE POLICY "update own form subs" ON public.app_form_submissions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.user_id = auth.uid())
  );
CREATE POLICY "delete own form subs" ON public.app_form_submissions FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.user_id = auth.uid())
  );

-- push subscribers
CREATE TABLE public.notification_subscribers (
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
CREATE POLICY "read own subs" ON public.notification_subscribers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND (a.user_id = auth.uid() OR has_role(auth.uid(), 'owner')))
  );

-- campaigns
CREATE TABLE public.notification_campaigns (
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
CREATE POLICY "own campaigns" ON public.notification_campaigns FOR ALL TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = user_id);
