CREATE POLICY "Certificados podem ser inseridos por todos"
  ON public.certificados FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Certificados podem ser atualizados por todos"
  ON public.certificados FOR UPDATE
  USING (true);