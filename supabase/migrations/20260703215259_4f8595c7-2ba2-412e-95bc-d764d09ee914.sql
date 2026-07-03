-- Extend qa_runs with progress fields
ALTER TABLE public.qa_runs
  ADD COLUMN IF NOT EXISTS progress_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_stage text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS verdict text,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Pages discovered/scraped per run
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_pages TO authenticated;
GRANT ALL ON public.qa_pages TO service_role;
ALTER TABLE public.qa_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own qa_pages" ON public.qa_pages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS qa_pages_run_id_idx ON public.qa_pages(run_id);

-- Findings per run
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_findings TO authenticated;
GRANT ALL ON public.qa_findings TO service_role;
ALTER TABLE public.qa_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own qa_findings" ON public.qa_findings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS qa_findings_run_id_idx ON public.qa_findings(run_id);