CREATE POLICY "Users delete own qa runs" ON public.qa_runs FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users delete own qa pages" ON public.qa_pages FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Users delete own qa findings" ON public.qa_findings FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
DELETE FROM public.qa_runs WHERE user_id = '2805d9cf-af87-4cd6-b113-6da5fae7a437';