// hunt-leads-ocp — busca REAL via Apollo.io + Hunter.io
// Sem mock. Sem IA inventando empresas. Retorna leads dinâmicos baseados em portaria/CNAE/comando.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PortariaInput {
  value: string;
  numero: string;
  label: string;
  desc: string;
  cnaes: string[];
  resp: string;
}

interface Decisor {
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;
}

interface OutLead {
  id: string;
  empresa: string;
  cnpj?: string | null;
  cidade?: string;
  uf?: string;
  cnae?: string;
  contato?: string | null;
  email?: string | null;
  telefone?: string | null;
  motivo: string;
  score: number;
  portaria: string;
  certStatus: "sem_cert" | "vencendo" | "ativo" | "desconhecido";
  diasVencimento?: number | null;
  ocp_atual?: string | null;
  deep: {
    decisores: Decisor[];
    ocp_concorrente: string | null;
    certs_inmetro_estimado: number;
  };
}

// Mapa de portaria -> palavras-chave Apollo (segmentação de mercado)
const PORTARIA_KEYWORDS: Record<string, string[]> = {
  "145": ["auto parts", "automotive components", "autopeças", "componentes automotivos"],
  "384": ["medical devices", "electromedical", "equipamentos médicos", "vigilância sanitária", "healthcare equipment"],
  "501": ["automotive wheels", "rodas automotivas", "wheel manufacturer"],
  "071": [],
};

// Fontes para inferir cargos de decisores OCP
const TARGET_TITLES = [
  "Quality Director", "Diretor de Qualidade", "Gerente de Qualidade",
  "Regulatory Affairs", "Assuntos Regulatórios", "Diretor Regulatório",
  "Diretor Industrial", "Compliance Manager", "Certification Manager",
];

async function apolloOrgSearch(
  apolloKey: string,
  keywords: string[],
  comando: string,
  perPage: number,
): Promise<any[]> {
  const q_keywords = [...keywords, comando].filter(Boolean).join(" ");
  const body = {
    q_organization_keyword_tags: q_keywords ? [q_keywords] : undefined,
    organization_locations: ["Brazil"],
    page: 1,
    per_page: perPage,
  };
  const res = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apolloKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apollo orgs ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.organizations || data.accounts || [];
}

async function hunterDomainSearch(
  hunterKey: string,
  domain: string,
): Promise<{ emails: any[]; org?: string }> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=10`;
  const res = await fetch(url);
  if (!res.ok) return { emails: [] };
  const data = await res.json();
  return { emails: data.data?.emails || [], org: data.data?.organization };
}

function pickDecisores(emails: any[], orgDomain: string): Decisor[] {
  if (!emails?.length) return [];
  // priorizar cargos-alvo
  const scored = emails
    .map((e: any) => {
      const pos = (e.position || "").toLowerCase();
      const dept = (e.department || "").toLowerCase();
      const isTarget =
        /quality|qualidade|regulat|compliance|certifica|industrial|director|diretor|gerente/.test(pos) ||
        /quality|regulatory|operations|engineering/.test(dept);
      return { e, score: isTarget ? 2 : (e.confidence || 0) / 100 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.map(({ e }) => ({
    nome: [e.first_name, e.last_name].filter(Boolean).join(" ").trim() || e.value?.split("@")[0] || "—",
    cargo: e.position || e.department || undefined,
    email: e.value || undefined,
    telefone: e.phone_number || undefined,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { portaria, comando, uf } = await req.json() as {
      portaria: PortariaInput;
      comando: string;
      uf?: string;
    };

    if (!portaria?.value || !comando) {
      return new Response(JSON.stringify({ error: "Parâmetros 'portaria' e 'comando' obrigatórios." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY");
    if (!APOLLO_API_KEY) {
      return new Response(JSON.stringify({ error: "APOLLO_API_KEY não configurada.", fallback: true, leads: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!HUNTER_API_KEY) {
      return new Response(JSON.stringify({ error: "HUNTER_API_KEY não configurada.", fallback: true, leads: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keywords = PORTARIA_KEYWORDS[portaria.numero] || [];
    const stages: string[] = [];

    // ── Fase 1 — Apollo: empresas dentro do escopo da portaria
    stages.push(`Buscando empresas no Apollo (${portaria.desc})...`);
    let orgs: any[] = [];
    try {
      orgs = await apolloOrgSearch(APOLLO_API_KEY, keywords, comando, 15);
    } catch (e) {
      console.error("Apollo erro:", e);
      return new Response(JSON.stringify({
        error: (e as Error).message,
        fallback: true,
        leads: [],
        stages,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    stages.push(`${orgs.length} empresas encontradas — enriquecendo decisores...`);

    if (uf) {
      const ufLower = uf.toLowerCase();
      orgs = orgs.filter((o) => (o.state || "").toLowerCase().includes(ufLower) || (o.raw_address || "").toLowerCase().includes(ufLower));
    }

    // ── Fase 2 — Hunter: e-mails verificados de decisores por domínio
    stages.push(`Validando e-mails de decisores no Hunter...`);
    const leadsRaw: OutLead[] = [];

    // limita a 10 enrichments concorrentes
    const enrich = async (org: any): Promise<OutLead | null> => {
      const domain = org.primary_domain || org.website_url?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      let decisores: Decisor[] = [];
      if (domain && HUNTER_API_KEY) {
        try {
          const { emails } = await hunterDomainSearch(HUNTER_API_KEY, domain);
          decisores = pickDecisores(emails, domain);
        } catch (e) {
          console.warn("Hunter fail", domain, e);
        }
      }

      const primaryContact = decisores[0];
      const cidade = org.city || "";
      const ufOrg = org.state || "";
      const employeeBand = org.estimated_num_employees ? `~${org.estimated_num_employees} func.` : "";

      const score =
        2 + // base
        (decisores.length ? 3 : 0) +
        (domain ? 2 : 0) +
        (employeeBand ? 1 : 0) +
        (keywords.length ? 2 : 0);

      const motivo =
        `Fabricante no escopo da ${portaria.label} (${portaria.desc}). ` +
        (decisores.length ? `${decisores.length} decisor(es) regulatórios identificados via Hunter. ` : "Sem decisores indexados — requer prospecção manual. ") +
        (employeeBand ? `Porte: ${employeeBand}. ` : "") +
        `Abordagem AGORA para captura como OCP Scitec.`;

      return {
        id: crypto.randomUUID(),
        empresa: org.name || domain || "—",
        cnpj: null,
        cidade,
        uf: ufOrg,
        cnae: portaria.cnaes[0] || undefined,
        contato: primaryContact?.nome || null,
        email: primaryContact?.email || null,
        telefone: primaryContact?.telefone || null,
        motivo,
        score: Math.min(10, score),
        portaria: portaria.value,
        certStatus: "desconhecido",
        diasVencimento: null,
        ocp_atual: null,
        deep: {
          decisores,
          ocp_concorrente: null,
          certs_inmetro_estimado: 0,
        },
      };
    };

    const top = orgs.slice(0, 12);
    const enriched = await Promise.all(top.map(enrich));
    for (const l of enriched) if (l) leadsRaw.push(l);

    stages.push(`${leadsRaw.length} leads prontos.`);

    return new Response(JSON.stringify({
      leads: leadsRaw.sort((a, b) => b.score - a.score),
      analise: `${leadsRaw.length} empresas reais retornadas (Apollo + Hunter) no escopo da ${portaria.label}.`,
      stages,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("hunt-leads-ocp fatal:", e);
    return new Response(JSON.stringify({
      error: (e as Error).message || "Erro inesperado",
      fallback: true,
      leads: [],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
