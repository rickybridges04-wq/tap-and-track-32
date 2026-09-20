DROP POLICY IF EXISTS "qa evidence read own" ON storage.objects;
CREATE POLICY "qa evidence read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'qa-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "qa evidence insert own" ON storage.objects;
CREATE POLICY "qa evidence insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qa-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "qa evidence delete own" ON storage.objects;
CREATE POLICY "qa evidence delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'qa-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);