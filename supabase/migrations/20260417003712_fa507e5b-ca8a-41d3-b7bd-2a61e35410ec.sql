CREATE TABLE public.certificados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_certificado TEXT NOT NULL,
  cnpj_empresa TEXT,
  razao_social TEXT,
  data_validade DATE NOT NULL,
  status_registro TEXT DEFAULT 'ativo',
  portaria TEXT,
  titular TEXT DEFAULT 'Scitec Inspeções e Certificações',
  numero_acreditacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (numero_certificado)
);

CREATE INDEX idx_certificados_cnpj ON public.certificados(cnpj_empresa);
CREATE INDEX idx_certificados_validade ON public.certificados(data_validade);

ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Certificados são visíveis para todos"
  ON public.certificados FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.update_certificados_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_certificados_updated_at
BEFORE UPDATE ON public.certificados
FOR EACH ROW EXECUTE FUNCTION public.update_certificados_updated_at();