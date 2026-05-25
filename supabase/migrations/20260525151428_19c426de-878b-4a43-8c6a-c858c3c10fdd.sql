-- Restrict leads SELECT to authenticated users
DROP POLICY IF EXISTS "Leads are viewable by everyone" ON public.leads;
CREATE POLICY "Leads viewable by authenticated users"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

-- Restrict certificados write access to authenticated users
DROP POLICY IF EXISTS "Certificados podem ser inseridos por todos" ON public.certificados;
DROP POLICY IF EXISTS "Certificados podem ser atualizados por todos" ON public.certificados;
DROP POLICY IF EXISTS "Certificados são visíveis para todos" ON public.certificados;

CREATE POLICY "Certificados viewable by authenticated users"
  ON public.certificados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Certificados insertable by authenticated users"
  ON public.certificados FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Certificados updatable by authenticated users"
  ON public.certificados FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);