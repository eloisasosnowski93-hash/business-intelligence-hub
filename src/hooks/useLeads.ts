import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Lead {
  id: string;
  nome_negocio: string | null;
  empresa: string;
  qualificacao: number | null;
  funil: string | null;
  etapa: string | null;
  estado_negocio: string | null;
  motivo_perda: string | null;
  valor_unico: number;
  valor_recorrente: number;
  data_criacao_original: string | null;
  responsavel: string | null;
  contato_nome: string | null;
  contato_cargo: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  origem_lead: string | null;
  cliente_tipo: string | null;
  tipo_proposta: string | null;
  sdr: string | null;
  categoria: string;
  responsavel_csv: string | null;
  produtos: string | null;
  nacionalidade: string | null;
  created_at: string;
}

export const CATEGORIA_LABELS: Record<string, string> = {
  portaria_145_2022: "Portaria 145/2022 — Automotivo",
  endotoxina_esterilidade: "Endotoxina & Esterilidade",
  mri_iso10993: "MRI & ISO 10993/18",
  portaria_384_2020: "Portaria 384/2020 — Vigilância Sanitária",
};

export const CATEGORIA_RESPONSAVEL: Record<string, string> = {
  portaria_145_2022: "Eloisa",
  endotoxina_esterilidade: "Kevin",
  mri_iso10993: "Ana Beatriz",
  portaria_384_2020: "Ana Carolina",
};

export function useLeads(categoria?: string) {
  return useQuery({
    queryKey: ["leads", categoria],
    queryFn: async () => {
      let query = supabase.from("leads").select("*");
      if (categoria) {
        query = query.eq("categoria", categoria);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Lead[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useLeadStats() {
  return useQuery({
    queryKey: ["lead-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("categoria, estado_negocio, etapa, motivo_perda, valor_unico, valor_recorrente");
      if (error) throw error;
      const leads = data || [];
      
      const byCategoria: Record<string, number> = {};
      const byEstado: Record<string, number> = {};
      const byEtapa: Record<string, number> = {};
      let vendidas = 0, perdidas = 0, emAndamento = 0;
      let totalValor = 0;

      for (const l of leads) {
        byCategoria[l.categoria] = (byCategoria[l.categoria] || 0) + 1;
        if (l.estado_negocio) byEstado[l.estado_negocio] = (byEstado[l.estado_negocio] || 0) + 1;
        if (l.etapa) byEtapa[l.etapa] = (byEtapa[l.etapa] || 0) + 1;
        if (l.estado_negocio === "Vendida") vendidas++;
        if (l.estado_negocio === "Perdida") perdidas++;
        if (l.estado_negocio === "Em Andamento") emAndamento++;
        totalValor += (l.valor_unico || 0) + (l.valor_recorrente || 0);
      }

      return {
        total: leads.length,
        vendidas,
        perdidas,
        emAndamento,
        totalValor,
        byCategoria,
        byEstado,
        byEtapa,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
