
ALTER TABLE public.certificados
  ADD COLUMN IF NOT EXISTS organismo_certificador text NOT NULL DEFAULT 'SCITEC';

-- Garante que registros antigos fiquem rotulados corretamente
UPDATE public.certificados SET organismo_certificador = 'SCITEC'
  WHERE organismo_certificador IS NULL OR organismo_certificador = '';

-- Limpeza estrita: remove qualquer linha que não seja SCITEC
DELETE FROM public.certificados
WHERE upper(coalesce(organismo_certificador, '')) <> 'SCITEC';

-- Também limpa as linhas simuladas/fake antigas que poluíram o painel
DELETE FROM public.certificados
WHERE numero_certificado LIKE 'SCITEC-%';

CREATE INDEX IF NOT EXISTS idx_certificados_organismo ON public.certificados(organismo_certificador);
