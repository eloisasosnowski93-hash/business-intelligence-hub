/**
 * useMonitoredPortarias
 * ──────────────────────────────────────────────────────────────────────────
 * Gerencia as "Portarias Monitoradas" — portarias INMETRO que o usuário
 * ativou para prospecção contínua. Persiste na tabela `leads` como registros
 * de categoria especial OU usa localStorage como fallback leve.
 *
 * Arquitetura:
 *  - Armazena metadados no localStorage (sem RLS, sem auth requerido)
 *  - Cross-references com a tabela `certificados` para calcular criticidade
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MonitoredPortaria {
  numero: string;           // "384", "145", "501", "071"
  label: string;            // "Portaria 384/2020"
  descricao: string;        // "Equip. Vigilância Sanitária"
  responsavel: string;
  ativadaEm: string;        // ISO timestamp
  totalMapeadas: number;    // empresas encontradas
  criticos: number;         // vencendo <= 90d
  ultimaAtualizacao: string;
}

const STORAGE_KEY = "scitec_ocp_portarias_monitoradas";

const PORTARIA_META: Record<string, { label: string; descricao: string; responsavel: string }> = {
  "145": { label: "Portaria 145/2022", descricao: "Componentes Automotivos",        responsavel: "Eloisa" },
  "384": { label: "Portaria 384/2020", descricao: "Equip. Vigilância Sanitária",     responsavel: "Ana Carolina" },
  "501": { label: "Portaria 501/2021", descricao: "Rodas",                           responsavel: "Eloisa" },
  "071": { label: "Portaria 071/2022", descricao: "Outros / Geral",                  responsavel: "Eloisa" },
  "715": { label: "Portaria 715/2022", descricao: "ANATEL / Telecomunicações",       responsavel: "Ana Carolina" },
  "407": { label: "Portaria 407/2019", descricao: "Pneus",                           responsavel: "Eloisa" },
  "301": { label: "Portaria 301/2012", descricao: "Brinquedos",                      responsavel: "Ana Carolina" },
};

function normalizeNumero(raw: string): string {
  // "384/2020" → "384", "portaria 384" → "384"
  return raw.replace(/[^0-9]/g, "").replace(/^0+/, "").slice(0, 6);
}

function getMetaForPortaria(numero: string) {
  return PORTARIA_META[numero] ?? {
    label: `Portaria ${numero}`,
    descricao: "Portaria INMETRO",
    responsavel: "A definir",
  };
}

export function useMonitoredPortarias() {
  const [portarias, setPortarias] = useState<MonitoredPortaria[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Persist on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portarias));
  }, [portarias]);

  // Hydrate criticidade counts from supabase
  const { data: certMap } = useQuery({
    queryKey: ["cert-map-for-monitoring"],
    queryFn: async () => {
      const { data } = await supabase
        .from("certificados")
        .select("portaria, data_validade, cnpj_empresa");
      const map: Record<string, { total: number; criticos: number }> = {};
      const today = Date.now();
      for (const c of data ?? []) {
        const portNum = (c.portaria || "").replace(/[^0-9]/g, "").replace(/^0+/, "");
        if (!map[portNum]) map[portNum] = { total: 0, criticos: 0 };
        map[portNum].total++;
        if (c.data_validade) {
          const diff = (new Date(c.data_validade).getTime() - today) / 86400000;
          if (diff <= 90) map[portNum].criticos++;
        }
      }
      return map;
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5min
  });

  // Merge live counts into portarias list
  const portariasWithCounts: MonitoredPortaria[] = portarias.map((p) => {
    const live = certMap?.[p.numero];
    return {
      ...p,
      totalMapeadas: live?.total ?? p.totalMapeadas,
      criticos: live?.criticos ?? p.criticos,
    };
  });

  const addPortaria = useCallback(
    async (rawNumero: string): Promise<{ ok: boolean; message: string; portaria?: MonitoredPortaria }> => {
      const numero = normalizeNumero(rawNumero);
      if (!numero || numero.length < 2) {
        return { ok: false, message: "Número de portaria inválido. Use o número (ex: 384, 145)." };
      }
      if (portarias.find((p) => p.numero === numero)) {
        return { ok: false, message: `Portaria ${numero} já está sendo monitorada.` };
      }

      const meta = getMetaForPortaria(numero);
      const live = certMap?.[numero];

      const nova: MonitoredPortaria = {
        numero,
        ...meta,
        ativadaEm: new Date().toISOString(),
        totalMapeadas: live?.total ?? 0,
        criticos: live?.criticos ?? 0,
        ultimaAtualizacao: new Date().toISOString(),
      };

      setPortarias((prev) => [...prev, nova]);
      return { ok: true, message: `Portaria ${meta.label} ativada com sucesso!`, portaria: nova };
    },
    [portarias, certMap]
  );

  const removePortaria = useCallback((numero: string) => {
    setPortarias((prev) => prev.filter((p) => p.numero !== numero));
  }, []);

  const refreshPortaria = useCallback(
    async (numero: string) => {
      const live = certMap?.[numero];
      setPortarias((prev) =>
        prev.map((p) =>
          p.numero === numero
            ? { ...p, totalMapeadas: live?.total ?? p.totalMapeadas, criticos: live?.criticos ?? p.criticos, ultimaAtualizacao: new Date().toISOString() }
            : p
        )
      );
    },
    [certMap]
  );

  return {
    portarias: portariasWithCounts,
    addPortaria,
    removePortaria,
    refreshPortaria,
  };
}
