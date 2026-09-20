CREATE TABLE IF NOT EXISTS public.failure_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.qa_projects(id) ON DELETE CASCADE,
  error_signature text NOT NULL,
  first_seen_result_id uuid REFERENCES public.automated_results(id) ON DELETE SET NULL,
  occurrences integer NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  likely_cause text,
  repro_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_severity text CHECK (suggested_severity IN ('low','medium','high','critical')),
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  basis text NOT NULL DEFAULT 'inferred',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, error_signature)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.failure_analyses TO authenticated;
GRANT ALL ON public.failure_analyses TO service_role;
ALTER TABLE public.failure_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "failure_analyses own" ON public.failure_analyses;
CREATE POLICY "failure_analyses own" ON public.failure_analyses FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS failure_analyses_user_idx ON public.failure_analyses(user_id);
CREATE INDEX IF NOT EXISTS failure_analyses_project_idx ON public.failure_analyses(project_id);
CREATE INDEX IF NOT EXISTS failure_analyses_result_idx ON public.failure_analyses(first_seen_result_id);

CREATE TABLE IF NOT EXISTS public.bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.qa_projects(id) ON DELETE SET NULL,
  result_id uuid REFERENCES public.automated_results(id) ON DELETE SET NULL,
  failure_analysis_id uuid REFERENCES public.failure_analyses(id) ON DELETE SET NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wontfix')),
  assignee text,
  steps_to_reproduce jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected text,
  actual text,
  likely_cause text,
  screenshot_path text,
  github_issue_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bugs TO authenticated;
GRANT ALL ON public.bugs TO service_role;
ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bugs own" ON public.bugs;
CREATE POLICY "bugs own" ON public.bugs FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bugs_user_idx ON public.bugs(user_id);
CREATE INDEX IF NOT EXISTS bugs_project_idx ON public.bugs(project_id);
CREATE INDEX IF NOT EXISTS bugs_result_idx ON public.bugs(result_id);
CREATE INDEX IF NOT EXISTS bugs_analysis_idx ON public.bugs(failure_analysis_id);
CREATE INDEX IF NOT EXISTS bugs_status_idx ON public.bugs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bug_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id uuid NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_comments TO authenticated;
GRANT ALL ON public.bug_comments TO service_role;
ALTER TABLE public.bug_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bug_comments own" ON public.bug_comments;
CREATE POLICY "bug_comments own" ON public.bug_comments FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bug_comments_bug_idx ON public.bug_comments(bug_id, created_at);
CREATE INDEX IF NOT EXISTS bug_comments_user_idx ON public.bug_comments(user_id);

DROP TRIGGER IF EXISTS failure_analyses_updated_at ON public.failure_analyses;
CREATE TRIGGER failure_analyses_updated_at BEFORE UPDATE ON public.failure_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS bugs_updated_at ON public.bugs;
CREATE TRIGGER bugs_updated_at BEFORE UPDATE ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();