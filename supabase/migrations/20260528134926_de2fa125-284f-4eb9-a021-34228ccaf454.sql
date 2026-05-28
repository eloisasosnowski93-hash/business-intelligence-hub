DROP POLICY IF EXISTS "Certificados public insert" ON public.certificados;
DROP POLICY IF EXISTS "Certificados public update" ON public.certificados;
DROP POLICY IF EXISTS "Certificados public delete" ON public.certificados;

CREATE POLICY "Certificados authenticated insert" ON public.certificados
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Certificados authenticated update" ON public.certificados
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Certificados authenticated delete" ON public.certificados
  FOR DELETE TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.certificados FROM anon;