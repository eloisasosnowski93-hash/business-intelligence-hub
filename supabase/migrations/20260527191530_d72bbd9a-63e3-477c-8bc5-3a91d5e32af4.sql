
-- Garantir grants para anon (Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificados TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificados TO authenticated;
GRANT ALL ON public.certificados TO service_role;

-- Remover políticas antigas restritivas
DROP POLICY IF EXISTS "Certificados viewable by authenticated users" ON public.certificados;
DROP POLICY IF EXISTS "Certificados insertable by authenticated users" ON public.certificados;
DROP POLICY IF EXISTS "Certificados updatable by authenticated users" ON public.certificados;
DROP POLICY IF EXISTS "Certificados public read" ON public.certificados;
DROP POLICY IF EXISTS "Certificados public insert" ON public.certificados;
DROP POLICY IF EXISTS "Certificados public update" ON public.certificados;
DROP POLICY IF EXISTS "Certificados public delete" ON public.certificados;

-- Políticas públicas (app interno sem auth)
CREATE POLICY "Certificados public read" ON public.certificados
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Certificados public insert" ON public.certificados
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Certificados public update" ON public.certificados
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Certificados public delete" ON public.certificados
  FOR DELETE TO anon, authenticated USING (true);
