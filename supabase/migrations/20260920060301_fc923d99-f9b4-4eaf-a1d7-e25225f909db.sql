-- Realtime for live automated run screens (RLS still applies to subscribers).
ALTER TABLE public.qa_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.automated_results REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_jobs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.automated_results;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- One shared settle function: when every job of a run is settled, complete the
-- run with counts, score and verdict. Used by the report route, the claim
-- function and the stale-heartbeat sweep so a run can never hang in progress.
CREATE OR REPLACE FUNCTION public.settle_qa_run(p_run_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outstanding int;
  v_total int;
  v_passed int;
  v_failed int;
  v_a11y int := 0;
  v_perf int := 0;
  v_score int;
  v_verdict text;
BEGIN
  SELECT count(*) INTO v_outstanding
    FROM public.qa_jobs
   WHERE run_id = p_run_id AND status IN ('queued', 'claimed');
  IF v_outstanding > 0 THEN
    RETURN;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'pass')
    INTO v_total, v_passed
    FROM public.automated_results
   WHERE run_id = p_run_id;
  v_failed := COALESCE(v_total, 0) - COALESCE(v_passed, 0);

  SELECT LEAST(25, COALESCE(SUM(
           CASE WHEN v.impact IN ('critical', 'serious') THEN 6
                WHEN v.impact = 'moderate' THEN 3
                ELSE 1 END), 0))::int
    INTO v_a11y
    FROM (
      SELECT DISTINCT r.id AS rid, e->>'id' AS vid, e->>'impact' AS impact
        FROM public.automated_results r,
             jsonb_array_elements(COALESCE(r.axe_violations, '[]'::jsonb)) e
       WHERE r.run_id = p_run_id
    ) v;

  SELECT LEAST(25, COALESCE(SUM(q.p), 0))::int INTO v_perf
    FROM (
      SELECT (
        CASE WHEN (web_vitals->>'lcp_ms')::numeric > 4000 THEN 6
             WHEN (web_vitals->>'lcp_ms')::numeric > 2500 THEN 3
             ELSE 0 END
      + CASE WHEN (web_vitals->>'cls')::numeric > 0.25 THEN 6
             WHEN (web_vitals->>'cls')::numeric > 0.1 THEN 3
             ELSE 0 END
      + CASE WHEN (web_vitals->>'ttfb_ms')::numeric > 1800 THEN 3
             ELSE 0 END) AS p
        FROM public.automated_results
       WHERE run_id = p_run_id
    ) q;

  v_score := GREATEST(0, 100
    - CASE WHEN COALESCE(v_total, 0) = 0 THEN 0
           ELSE round((v_failed::numeric / v_total) * 50)::int END
    - v_a11y - v_perf);
  v_verdict := CASE WHEN v_score >= 90 THEN 'ready'
                    WHEN v_score >= 75 THEN 'minor'
                    WHEN v_score >= 50 THEN 'major'
                    ELSE 'blocked' END;

  UPDATE public.qa_runs
     SET status = 'completed',
         progress_pct = 100,
         progress_stage = 'Complete',
         score = v_score,
         verdict = v_verdict,
         passed_count = v_passed,
         failed_count = v_failed,
         completed_at = COALESCE(completed_at, now()),
         updated_at = now()
   WHERE id = p_run_id
     AND status <> 'completed';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_qa_run(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_qa_run(uuid) TO service_role;

-- Claim: also fail unrunnable jobs (missing case / invalid steps) and settle
-- every run touched by the stale sweep or by such a failure.
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
  v_run_id uuid;
BEGIN
  UPDATE public.qa_jobs
     SET status = 'queued', claimed_by = NULL, claimed_at = NULL, heartbeat_at = NULL
   WHERE status = 'claimed'
     AND heartbeat_at < now() - interval '5 minutes'
     AND attempts < 3;

  FOR v_run_id IN
    UPDATE public.qa_jobs
       SET status = 'failed', error = 'worker lost'
     WHERE status = 'claimed'
       AND heartbeat_at < now() - interval '5 minutes'
       AND attempts >= 3
    RETURNING run_id
  LOOP
    PERFORM public.settle_qa_run(v_run_id);
  END LOOP;

  SELECT * INTO v_job
    FROM public.qa_jobs
   WHERE status = 'queued'
   ORDER BY created_at
     FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_case FROM public.test_cases WHERE id = v_job.case_id;
  SELECT * INTO v_run FROM public.qa_runs WHERE id = v_job.run_id;
  SELECT * INTO v_project FROM public.qa_projects WHERE id = v_run.project_id;

  -- Unrunnable job: fail it now and settle its run instead of handing it out.
  IF v_case.id IS NULL
     OR jsonb_typeof(COALESCE(v_case.steps_json, 'null'::jsonb)) <> 'array'
     OR jsonb_array_length(v_case.steps_json) = 0 THEN
    UPDATE public.qa_jobs
       SET status = 'failed',
           error = CASE WHEN v_case.id IS NULL THEN 'case not found' ELSE 'invalid steps' END
     WHERE id = v_job.id;
    PERFORM public.settle_qa_run(v_job.run_id);
    RETURN NULL;
  END IF;

  UPDATE public.qa_jobs
     SET status = 'claimed',
         claimed_by = p_worker,
         claimed_at = now(),
         heartbeat_at = now(),
         attempts = attempts + 1
   WHERE id = v_job.id;

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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_qa_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_qa_job(text) TO service_role;

-- Read-only, expiring share links for automated run reports.
CREATE TABLE public.qa_report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.qa_runs(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qa_report_shares_run_id ON public.qa_report_shares(run_id);
CREATE INDEX idx_qa_report_shares_user_id ON public.qa_report_shares(user_id);

GRANT SELECT, INSERT, DELETE ON public.qa_report_shares TO authenticated;
GRANT ALL ON public.qa_report_shares TO service_role;
ALTER TABLE public.qa_report_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own report share links"
  ON public.qa_report_shares FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (user_id = auth.uid());