// hunt-leads-ocp — Apollo /v1/people/search (plano free) + BrasilAPI fallback
// O endpoint mixed_companies/search exige plano pago → substituído por people/search.

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

// ── Palavras-chave por portaria (para busca Apollo people) ─────────────────
const PORTARIA_KEYWORDS: Record<string, string[]> = {
  "145": ["automotive", "auto parts", "autopeças", "componentes automotivos", "vehicle parts"],
  "384": ["medical devices", "electromedical", "equipamentos médicos", "vigilância sanitária"],
  "501": ["automotive wheels", "rodas automotivas", "wheel manufacturer", "rims"],
  "071": ["manufacturing", "fabricação industrial", "industrial products"],
};

// CNAEs BrasilAPI por portaria (4 dígitos)
const PORTARIA_CNAES_BRASIL: Record<string, string[]> = {
  "145": ["2910", "2920", "2930", "2941", "2942"],
  "384": ["3250", "2660", "3841", "3842"],
  "501": ["2941", "2942", "2949"],
  "071": ["2800", "2810", "2820"],
};

// Títulos-alvo para decisores OCP
const TARGET_TITLES = [
  "Diretor de Qualidade",
  "Quality Director",
  "Gerente de Qualidade",
  "Quality Manager",
  "Regulatory Affairs",
  "Assuntos Regulatórios",
  "Compliance Manager",
  "Certification Manager",
  "Diretor Industrial",
];

// ── Apollo People Search (endpoint disponível no plano free) ───────────────
async function apolloPeopleSearch(
  apolloKey: string,
  portariaNumero: string,
  comando: string,
  uf?: string,
): Promise<any[]> {
  const keywords = PORTARIA_KEYWORDS[portariaNumero] || ["manufacturing", "industrial"];
  const body: Record<string, unknown> = {
    person_titles: TARGET_TITLES.slice(0, 4),
    person_locations: uf ? [`${uf}, Brazil`] : ["Brazil"],
    page: 1,
    per_page: 15,
  };

  // q_keywords melhora relevância mas não é obrigatório
  const qkw = [...keywords.slice(0, 2), comando.slice(0, 80)].join(" ");
  if (qkw.trim()) body.q_keywords = qkw;

  const res = await fetch("https://api.apollo.io/v1/people/search", {
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
    throw new Error(`Apollo people/search ${res.status}: ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.people || [];
}

// Converte lista de pessoas Apollo → orgs sintéticas agrupadas por empresa
function peopleToOrgs(people: any[]): any[] {
  const map = new Map<string, any>();
  for (const p of people) {
    const org = p.organization || {};
    const key = org.name || p.organization_name || "Desconhecida";
    if (!map.has(key)) {
      map.set(key, {
        name: key,
        primary_domain: org.primary_domain || org.website_url?.replace(/^https?:\/\//, "").split("/")[0] || "",
        city: org.city || p.city || "",
        state: org.state || p.state || "",
        estimated_num_employees: org.estimated_num_employees,
        _contacts: [],
      });
    }
    map.get(key)._contacts.push(p);
  }
  return Array.from(map.values());
}

// ── BrasilAPI fallback por CNAE ────────────────────────────────────────────
async function brasilApiByCnae(cnae: string): Promise<any[]> {
  try {
    // BrasilAPI não tem busca por CNAE diretamente — usar CNPJ.ws
    const res = await fetch(
      `https://www.receitaws.com.br/v1/cnpj/search?cnae=${cnae}&limit=5`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── Hunter.io domain search ────────────────────────────────────────────────
async function hunterDomainSearch(
  hunterKey: string,
  domain: string,
): Promise<{ emails: any[] }> {
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=8`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { emails: [] };
    const data = await res.json();
    return { emails: data.data?.emails || [] };
  } catch {
    return { emails: [] };
  }
}

function pickDecisores(emails: any[]): Decisor[] {
  if (!emails?.length) return [];
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

// ── Constrói decisores a partir de contatos Apollo ────────────────────────
function contactsToDecisores(contacts: any[]): Decisor[] {
  return contacts.slice(0, 3).map((p: any) => ({
    nome: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "—",
    cargo: p.title || p.headline || undefined,
    email: p.email || undefined,
    telefone: p.phone_numbers?.[0]?.sanitized_number || undefined,
  }));
}

// ── Enriquece org com Hunter ────────────────────────────────────────────────
async function enrichOrg(
  org: any,
  hunterKey: string | undefined,
  portaria: PortariaInput,
): Promise<OutLead> {
  const domain = org.primary_domain;
  let decisores: Decisor[] = [];

  // Primeiro tenta contatos já vindos do Apollo
  if (org._contacts?.length) {
    decisores = contactsToDecisores(org._contacts);
  }

  // Enriquece com Hunter se disponível e domínio conhecido
  if (hunterKey && domain && decisores.filter((d) => d.email).length === 0) {
    const { emails } = await hunterDomainSearch(hunterKey, domain);
    const hunterDecisores = pickDecisores(emails);
    if (hunterDecisores.length) decisores = hunterDecisores;
  }

  const primaryContact = decisores[0];
  const employeeBand = org.estimated_num_employees ? `~${org.estimated_num_employees} func.` : "";

  const score =
    2 + // base
    (decisores.length ? 3 : 0) +
    (domain ? 1 : 0) +
    (primaryContact?.email ? 2 : 0) +
    (employeeBand ? 1 : 0) +
    (portaria.cnaes.length ? 1 : 0);

  const motivo =
    `Empresa no escopo da ${portaria.label} (${portaria.desc}). ` +
    (decisores.length
      ? `${decisores.length} decisor(es) identificado(s) para abordagem direta. `
      : "Requer prospecção manual para mapear decisores. ") +
    (employeeBand ? `Porte: ${employeeBand}. ` : "") +
    `Oportunidade de captação como cliente OCP Scitec.`;

  return {
    id: crypto.randomUUID(),
    empresa: org.name || domain || "—",
    cnpj: null,
    cidade: org.city || "",
    uf: org.state || "",
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
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { portaria, comando, uf } = await req.json() as {
      portaria: PortariaInput;
      comando: string;
      uf?: string;
    };

    if (!portaria?.value || !comando) {
      return new Response(
        JSON.stringify({ error: "Parâmetros 'portaria' e 'comando' obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY");

    const stages: string[] = [];
    stages.push(`🎯 Escopo: ${portaria.label} — ${portaria.desc}`);

    // ── Fase 1: Apollo people/search (plano free compatível) ──────────────
    let orgs: any[] = [];

    if (!APOLLO_API_KEY) {
      stages.push("⚠️ APOLLO_API_KEY não configurada — pulando Apollo");
    } else {
      stages.push("🌐 Buscando decisores no Apollo (people/search)...");
      try {
        const people = await apolloPeopleSearch(APOLLO_API_KEY, portaria.numero, comando, uf);
        orgs = peopleToOrgs(people);
        stages.push(`${orgs.length} empresa(s) identificadas via Apollo people`);
      } catch (e) {
        const msg = (e as Error).message;
        console.error("Apollo erro:", msg);
        stages.push(`⚠️ Apollo indisponível: ${msg.slice(0, 120)}`);

        // ── Fallback: BrasilAPI por CNAE ───────────────────────────────
        stages.push("🔄 Tentando BrasilAPI como fallback...");
        const cnaes = PORTARIA_CNAES_BRASIL[portaria.numero] || [];
        if (cnaes.length > 0) {
          const results = await brasilApiByCnae(cnaes[0]);
          for (const r of results.slice(0, 8)) {
            orgs.push({
              name: r.razao_social || r.nome || "—",
              primary_domain: "",
              city: r.municipio || r.logradouro_municipio || "",
              state: r.uf || "",
              estimated_num_employees: undefined,
              _contacts: [],
              _cnpj: (r.cnpj || "").replace(/\D/g, ""),
            });
          }
          stages.push(`${orgs.length} empresa(s) via BrasilAPI fallback`);
        }

        if (!orgs.length) {
          return new Response(
            JSON.stringify({
              error: `Apollo indisponível (${msg.slice(0, 150)}) e sem resultados no fallback.`,
              fallback: true,
              leads: [],
              stages,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    if (!orgs.length) {
      return new Response(
        JSON.stringify({
          error: "Nenhuma empresa encontrada para este escopo. Tente um comando diferente.",
          fallback: true,
          leads: [],
          stages,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fase 2: Enriquecer com Hunter (se disponível) ─────────────────────
    if (HUNTER_API_KEY) {
      stages.push(`Validando e-mails de decisores no Hunter...`);
    }

    const top = orgs.slice(0, 12);
    const enriched = await Promise.all(
      top.map((org) => enrichOrg(org, HUNTER_API_KEY, portaria))
    );

    // Injeta CNPJ do fallback BrasilAPI quando disponível
    for (let i = 0; i < enriched.length; i++) {
      if (top[i]._cnpj) enriched[i].cnpj = top[i]._cnpj;
    }

    const leads = enriched
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    stages.push(`✅ ${leads.length} leads prontos`);

    return new Response(
      JSON.stringify({
        leads,
        analise: `${leads.length} empresa(s) mapeadas (Apollo people/search + Hunter) — ${portaria.label}.`,
        stages,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("hunt-leads-ocp fatal:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Erro inesperado",
        fallback: true,
        leads: [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
