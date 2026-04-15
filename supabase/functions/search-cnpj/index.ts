import { corsHeaders } from '@supabase/supabase-js/cors'

const BRASIL_API_BASE = "https://brasilapi.com.br/api";

// Simple in-memory cache (per instance)
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

// Lead scoring based on CNAE and portaria keywords
function scoreLead(
  company: Record<string, unknown>,
  portaria: string,
  unit: string
): { score: number; urgency: string; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const cnaeDesc = String(company.cnae_fiscal_descricao || "").toLowerCase();
  const cnaes = (company.cnaes_secundarios as Array<{ descricao: string }>) || [];
  const allCnaes = [cnaeDesc, ...cnaes.map((c) => String(c.descricao || "").toLowerCase())];

  const labKeywords = [
    "produto para saude", "produtos para saude", "equipamento medico",
    "implante", "protese", "dispositivo medico", "material hospitalar",
    "esteriliza", "endotoxina", "laboratorio", "ensaio",
  ];
  const ocpKeywords = [
    "certificacao", "automotivo", "colchao", "colchoes",
    "movel", "moveis", "brinquedo", "eletrodomestico", "eletronico",
  ];
  const keywords = unit === "lab" ? labKeywords : ocpKeywords;

  const portariaKeywords: Record<string, string[]> = {
    "145/2022": ["automotivo", "componente", "veicular", "automovel", "autopeca"],
    "384/2020": ["saude", "medic", "implante", "protese", "hospitalar", "vigilancia"],
    "endotoxina": ["esteriliza", "endotoxina", "bioburden", "saude", "medic"],
    "mri_iso10993": ["mri", "ressonancia", "biocompatibilidade", "implante"],
  };

  for (const kw of keywords) {
    if (allCnaes.some((c) => c.includes(kw))) {
      score += 5;
      reasons.push(`CNAE compatível: "${kw}"`);
      break;
    }
  }

  const nome = String(company.razao_social || "").toLowerCase();
  const pKws = portariaKeywords[portaria] || [];
  for (const kw of pKws) {
    if (nome.includes(kw) || allCnaes.some((c) => c.includes(kw))) {
      score += 5;
      reasons.push(`Portaria ${portaria} match: "${kw}"`);
      break;
    }
  }

  if (company.situacao_cadastral === 2) {
    score += 1;
    reasons.push("Empresa ativa");
  }

  const urgency = score >= 8 ? "hot" : score >= 5 ? "medio" : score >= 3 ? "normal" : "frio";
  return { score: Math.min(score, 10), urgency, reasons };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { cnpj, cnae, portaria, unit } = await req.json();

    if (cnpj) {
      const clean = cnpj.replace(/\D/g, "");
      if (clean.length !== 14) {
        return new Response(
          JSON.stringify({ error: "CNPJ deve ter 14 dígitos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cacheKey = `cnpj:${clean}`;
      let data = getCached(cacheKey);

      if (!data) {
        const res = await fetch(`${BRASIL_API_BASE}/cnpj/v1/${clean}`);
        if (!res.ok) {
          const errText = await res.text();
          console.error("BrasilAPI CNPJ error", res.status, errText);
          return new Response(
            JSON.stringify({ error: "Falha ao consultar CNPJ. Tente novamente." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        data = await res.json();
        cache.set(cacheKey, { data, ts: Date.now() });
      }

      const scoring = scoreLead(data as Record<string, unknown>, portaria || "145/2022", unit || "lab");

      return new Response(
        JSON.stringify({ company: data, scoring }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (cnae) {
      const cacheKey = `cnae:${cnae}`;
      let data = getCached(cacheKey);

      if (!data) {
        const res = await fetch(`${BRASIL_API_BASE}/cnae/v1/${cnae}`);
        if (!res.ok) {
          const errText = await res.text();
          console.error("BrasilAPI CNAE error", res.status, errText);
          return new Response(
            JSON.stringify({ error: `CNAE não encontrado: ${cnae}` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        data = await res.json();
        cache.set(cacheKey, { data, ts: Date.now() });
      }

      return new Response(
        JSON.stringify({ cnae_info: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Informe cnpj ou cnae" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("search-cnpj error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
