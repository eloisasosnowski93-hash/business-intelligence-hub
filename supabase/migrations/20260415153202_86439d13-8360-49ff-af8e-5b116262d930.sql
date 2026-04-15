
-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_negocio TEXT,
  empresa TEXT NOT NULL,
  qualificacao INTEGER,
  funil TEXT,
  etapa TEXT,
  estado_negocio TEXT,
  motivo_perda TEXT,
  valor_unico NUMERIC DEFAULT 0,
  valor_recorrente NUMERIC DEFAULT 0,
  data_criacao_original TEXT,
  responsavel TEXT,
  contato_nome TEXT,
  contato_cargo TEXT,
  contato_email TEXT,
  contato_telefone TEXT,
  origem_lead TEXT,
  cliente_tipo TEXT,
  tipo_proposta TEXT,
  sdr TEXT,
  categoria TEXT NOT NULL,
  responsavel_csv TEXT,
  produtos TEXT,
  nacionalidade TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Leads are viewable by everyone"
ON public.leads FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_leads_categoria ON public.leads(categoria);
CREATE INDEX idx_leads_estado ON public.leads(estado_negocio);
CREATE INDEX idx_leads_empresa ON public.leads(empresa);
CREATE INDEX idx_leads_etapa ON public.leads(etapa);
