import { useState } from "react";
import { useUnit } from "@/contexts/UnitContext";
import { useQuery } from "@tanstack/react-query";
import { useSearchLeads, CATEGORIA_LABELS, PORTARIA_TO_CATEGORIA } from "@/hooks/useLeads";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrgencyBadge, LeadScoreBadge } from "@/components/Badges";
import { Search, Loader2, Building2, MapPin, FileText, AlertCircle, Database, Globe, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function computeScoring(company: any, portaria: string) {
  const reasons: string[] = [];
  let score = 0;
  const cnae = String(company.cnae_fiscal);
  const allCnaes = [cnae, ...(company.cnaes_secundarios?.map((c: any) => String(c.codigo)) ?? [])];
  if (company.situacao_cadastral === 2) { score += 20; reasons.push("Empresa ativa"); }
  if (company.email) { score += 10; reasons.push("E-mail disponível"); }
  if (company.telefone_1) { score += 10; reasons.push("Telefone disponível"); }
  if (company.qsa?.length > 0) { score += 10; reasons.push("Decisores identificados"); }
  if (portaria === "endotoxina") {
    if (allCnaes.some(c => ["2110","2121","2122","2123","2130","3250"].some(a => c.startsWith(a)))) {
      score += 40; reasons.push("CNAE farmacêutico — demanda ensaios endotoxina");
    }
  }
  if (portaria === "mri_iso10993") {
    if (allCnaes.some(c => ["3250","2660","2670","2680"].some(a => c.startsWith(a)))) {
      score += 40; reasons.push("CNAE dispositivos médicos — elegível ISO 10993");
    }
  }
  if (portaria === "384/2020") {
    if (allCnaes.some(c => ["3250","2660","3841","3842","2651","2652"].some(a => c.startsWith(a)))) {
      score += 40; reasons.push("CNAE equip. médico/sanitário — elegível Portaria 384/2020");
    }
  }
  if (portaria === "145/2022") {
    if (allCnaes.some(c => ["2910","2920","2930","2941","2942","2949","4511","4530"].some(a => c.startsWith(a)))) {
      score += 40; reasons.push("CNAE automotivo — elegível Portaria 145/2022");
    }
  }
  return { score, urgency: score >= 60 ? "alta" : score >= 30 ? "media" : "baixa", reasons };
}

// LAB: apenas Endotoxina e MRI — SEM Portaria 145/2022 e SEM Eloisa
const PORTARIAS_LAB = [
  { value: "endotoxina", label: "Endotoxina & Esterilidade (Kevin)" },
  { value: "mri_iso10993", label: "MRI & ISO 10993/18 (Ana Beatriz)" },
];

// OCP: todas as portarias
const PORTARIAS_OCP = [
  { value: "145/2022", label: "Portaria 145/2022 — Automotivo (Eloisa)" },
  { value: "384/2020", label: "Portaria 384/2020 — Vigilância Sanitária (Ana Carolina)" },
  { value: "071/2022", label: "Portaria 071/2022" },
  { value: "501/2021", label: "Portaria 501/2021 — Rodas" },
];

const CNAES_LAB = [
  { code: "3250701", label: "3250-7/01 — Instrumentos médico-cirúrgicos" },
  { code: "3250706", label: "3250-7/06 — Material hospitalar" },
  { code: "2660400", label: "2660-4/00 — Aparelhos eletromédicos" },
  { code: "2651500", label: "2651-5/00 — Instrumentos de medida" },
  { code: "2110600", label: "2110-6/00 — Produtos farmacêuticos" },
  { code: "2121101", label: "2121-1/01 — Medicamentos uso humano" },
  { code: "3250709", label: "3250-7/09 — Outros equip. médicos" },
];

const CNAES_OCP = [
  { code: "2910701", label: "2910-7/01 — Automóveis e utilitários" },
  { code: "2941700", label: "2941-7/00 — Peças sistema motor" },
  { code: "2942500", label: "2942-5/00 — Peças transmissão" },
  { code: "2949299", label: "2949-2/99 — Outros acessórios automotivos" },
  { code: "3250701", label: "3250-7/01 — Equip. médico-cirúrgicos" },
  { code: "2660400", label: "2660-4/00 — Aparelhos eletromédicos" },
  { code: "2710401", label: "2710-4/01 — Motores e geradores" },
];

export default function Prospeccao() {
  const { unit, unitLabel } = useUnit();
  const [searchTab, setSearchTab] = useState<"interno" | "externo">("interno");
  const [internalSearch, setInternalSearch] = useState("");
  const [selectedPortaria, setSelectedPortaria] = useState(unit === "lab" ? "endotoxina" : "145/2022");
  const [searchType, setSearchType] = useState<"cnpj" | "cnae">("cnpj");
  const [cnpjInput, setCnpjInput] = useState("");
  const [selectedCnae, setSelectedCnae] = useState("");
  const [trigger, setTrigger] = useState<{ type: string; value: string; portaria: string } | null>(null);

  const portarias = unit === "lab" ? PORTARIAS_LAB : PORTARIAS_OCP;
  const cnaes = unit === "lab" ? CNAES_LAB : CNAES_OCP;
  const categoriaKey = PORTARIA_TO_CATEGORIA[selectedPortaria];
  const { data: internalLeads, isLoading: internalLoading } = useSearchLeads(internalSearch, categoriaKey);

  const cnpjQuery = useQuery({
    queryKey: ["brasilapi-cnpj", trigger],
    queryFn: async () => {
      const clean = trigger!.value.replace(/\D/g, "");
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `CNPJ não encontrado (${res.status})`);
      }
      const company = await res.json();
      // Monta contatos a partir do QSA (decisores)
      const decisores = (company.qsa || []).map((s: any) => ({
        nome: s.nome_socio,
        cargo: s.qualificacao_socio,
      }));
      return { company, scoring: computeScoring(company, trigger!.portaria), decisores };
    },
    enabled: !!trigger && trigger.type === "cnpj",
    retry: 0,
    staleTime: 1000 * 60 * 30,
  });

  const cnaeQuery = useQuery({
    queryKey: ["brasilapi-cnae", trigger],
    queryFn: async () => {
      // BrasilAPI CNAE v2 retorna info do CNAE
      const res = await fetch(`https://brasilapi.com.br/api/cnae/v2/${trigger!.value}`);
      if (!res.ok) throw new Error("CNAE não encontrado. Tente buscar por CNPJ diretamente.");
      return res.json();
    },
    enabled: !!trigger && trigger.type === "cnae",
    retry: 0,
    staleTime: 1000 * 60 * 60,
  });

  const handleSearch = () => {
    if (searchType === "cnpj") {
      const clean = cnpjInput.replace(/\D/g, "");
      if (clean.length !== 14) { toast.error("CNPJ deve ter 14 dígitos"); return; }
      setTrigger({ type: "cnpj", value: clean, portaria: selectedPortaria });
    } else {
      if (!selectedCnae) { toast.error("Selecione um CNAE"); return; }
      setTrigger({ type: "cnae", value: selectedCnae, portaria: selectedPortaria });
    }
  };

  const isLoading = cnpjQuery.isFetching || cnaeQuery.isFetching;
  const result = cnpjQuery.data;

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">{unit === "lab" ? "Prospecção — Laboratório" : "Prospecção — OCP"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Busca híbrida: base interna + BrasilAPI · {unitLabel}</p>
      </div>

      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-3">📋 Filtrar por Portaria / Área</h3>
        <div className="flex flex-wrap gap-2">
          {portarias.map(p => (
            <Button key={p.value} variant={selectedPortaria === p.value ? "default" : "outline"} size="sm"
              onClick={() => setSelectedPortaria(p.value)} className="text-xs">{p.label}</Button>
          ))}
        </div>
      </div>

      <Tabs value={searchTab} onValueChange={v => setSearchTab(v as "interno" | "externo")}>
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="interno" className="flex-1 gap-2"><Database className="h-4 w-4" />Base Interna (CRM)</TabsTrigger>
          <TabsTrigger value="externo" className="flex-1 gap-2"><Globe className="h-4 w-4" />Busca Externa (BrasilAPI)</TabsTrigger>
        </TabsList>

        <TabsContent value="interno" className="space-y-4">
          <div className="bento-card">
            <h3 className="text-sm font-heading font-semibold mb-3">🔍 Buscar na Base Interna</h3>
            <div className="flex gap-3">
              <Input placeholder="Empresa, contato, produto..." value={internalSearch}
                onChange={e => setInternalSearch(e.target.value)} className="flex-1" />
              {internalLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-2" />}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Filtrando: <strong>{CATEGORIA_LABELS[categoriaKey] || selectedPortaria}</strong>
              {internalLeads && ` · ${internalLeads.length} leads`}
            </p>
          </div>
          {internalLeads && internalLeads.length > 0 && (
            <div className="bento-card overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Empresa</TableHead><TableHead>Etapa</TableHead>
                  <TableHead>Estado</TableHead><TableHead>Contato</TableHead><TableHead>Responsável</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {internalLeads.slice(0, 50).map(l => (
                    <TableRow key={l.id} className="hover:bg-muted/50">
                      <TableCell><p className="font-medium text-sm">{l.empresa}</p>
                        {l.produtos && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{l.produtos}</p>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.etapa || "—"}</TableCell>
                      <TableCell><Badge variant={l.estado_negocio === "Vendida" ? "default" : l.estado_negocio === "Perdida" ? "destructive" : "secondary"} className="text-xs">{l.estado_negocio || "—"}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.contato_nome || "—"}
                        {l.contato_email && <div className="text-[10px]">{l.contato_email}</div>}
                        {l.contato_telefone && <div className="text-[10px]">{l.contato_telefone}</div>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.responsavel_csv || l.responsavel || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {internalLeads?.length === 0 && internalSearch.length >= 2 && (
            <div className="bento-card text-center py-8">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum lead encontrado na base interna</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearchTab("externo")}>
                <Globe className="h-4 w-4 mr-1" />Buscar via BrasilAPI
              </Button>
            </div>
          )}
          {(!internalLeads || internalLeads.length === 0) && internalSearch.length < 2 && (
            <div className="bento-card text-center py-12">
              <Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres para buscar</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="externo" className="space-y-4">
          <div className="bento-card">
            <h3 className="text-sm font-heading font-semibold mb-2">🌐 Busca Externa — BrasilAPI (Receita Federal)</h3>
            <p className="text-xs text-muted-foreground mb-4">
              A busca por CNPJ retorna dados cadastrais completos incluindo sócios/decisores.
              A busca por CNAE retorna a descrição oficial do código — para listar empresas de um setor, importe um CSV com CNPJs na seção CRM.
            </p>
            <div className="flex gap-2 mb-4">
              <Button variant={searchType === "cnpj" ? "default" : "outline"} size="sm" onClick={() => setSearchType("cnpj")}>
                <Building2 className="h-4 w-4 mr-1" />Por CNPJ
              </Button>
              <Button variant={searchType === "cnae" ? "default" : "outline"} size="sm" onClick={() => setSearchType("cnae")}>
                <FileText className="h-4 w-4 mr-1" />Por CNAE (descrição)
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchType === "cnpj" ? (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">CNPJ da empresa</label>
                  <Input placeholder="00.000.000/0001-00" value={cnpjInput}
                    onChange={e => setCnpjInput(formatCnpj(e.target.value))}
                    onKeyDown={e => e.key === "Enter" && handleSearch()} />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">CNAE</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCnae} onChange={e => setSelectedCnae(e.target.value)}>
                    <option value="">Selecione um CNAE...</option>
                    {cnaes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={isLoading} className="w-full gap-2">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar
                </Button>
              </div>
            </div>
          </div>

          {(cnpjQuery.error || cnaeQuery.error) && (
            <div className="bento-card border-l-4 border-l-destructive">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm font-medium">{(cnpjQuery.error as Error)?.message || (cnaeQuery.error as Error)?.message}</p>
              </div>
            </div>
          )}

          {cnaeQuery.data && trigger?.type === "cnae" && (
            <div className="bento-card">
              <h3 className="text-sm font-heading font-semibold mb-3">📋 Informações do CNAE</h3>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Código:</span> <Badge variant="outline">{cnaeQuery.data.codigo}</Badge></div>
                <div><span className="text-muted-foreground">Descrição:</span> <span className="font-medium">{cnaeQuery.data.descricao}</span></div>
                {cnaeQuery.data.observacoes && <div><span className="text-muted-foreground">Observações:</span> <span>{cnaeQuery.data.observacoes}</span></div>}
              </div>
              <div className="mt-3 p-3 bg-muted rounded-md text-xs text-muted-foreground">
                💡 Para prospectar empresas deste setor, importe uma planilha de CNPJs na seção <strong>CRM Leads</strong>. A BrasilAPI não possui endpoint de busca por setor.
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-slide-up">
              <div className="bento-card-accent">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-heading font-semibold">📊 Lead Scoring Automático</h3>
                  <div className="flex gap-2">
                    <LeadScoreBadge score={result.scoring.score} />
                    <UrgencyBadge urgency={result.scoring.urgency} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.scoring.reasons.map((r, i) => <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>)}
                  {!result.scoring.reasons.length && <span className="text-xs text-muted-foreground">Nenhum critério de portaria atendido</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bento-card">
                  <h3 className="text-sm font-heading font-semibold mb-3">🏢 Dados Cadastrais</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Razão Social:</span> <span className="font-medium">{result.company.razao_social}</span></div>
                    {result.company.nome_fantasia && <div><span className="text-muted-foreground">Fantasia:</span> <span>{result.company.nome_fantasia}</span></div>}
                    <div><span className="text-muted-foreground">CNPJ:</span> <span className="font-mono">{result.company.cnpj}</span></div>
                    <div><span className="text-muted-foreground">Situação:</span> <Badge variant={result.company.situacao_cadastral === 2 ? "default" : "destructive"} className="text-xs">{result.company.descricao_situacao_cadastral}</Badge></div>
                    <div className="flex gap-1"><MapPin className="h-3 w-3 mt-1 text-muted-foreground shrink-0" /><span>{result.company.logradouro}, {result.company.municipio}/{result.company.uf}</span></div>
                    {result.company.email && <div><span className="text-muted-foreground">Email:</span> <a href={`mailto:${result.company.email}`} className="text-primary hover:underline">{result.company.email}</a></div>}
                    {result.company.ddd_telefone_1 && <div><span className="text-muted-foreground">Tel:</span> <span>({result.company.ddd_telefone_1}) {result.company.telefone_1}</span></div>}
                    {result.company.porte && <div><span className="text-muted-foreground">Porte:</span> <Badge variant="outline" className="text-xs">{result.company.porte}</Badge></div>}
                    {result.company.natureza_juridica && <div><span className="text-muted-foreground">Natureza:</span> <span className="text-xs">{result.company.natureza_juridica}</span></div>}
                  </div>
                </div>

                <div className="bento-card">
                  <h3 className="text-sm font-heading font-semibold mb-3">📋 CNAEs</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Principal:</span>
                      <Badge variant="outline" className="text-xs ml-1">{result.company.cnae_fiscal}</Badge>
                      <p className="mt-1">{result.company.cnae_fiscal_descricao}</p>
                    </div>
                    {result.company.cnaes_secundarios?.length > 0 && (
                      <div><span className="text-muted-foreground block mb-1">Secundários:</span>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {result.company.cnaes_secundarios.slice(0, 10).map((c: any, i: number) => (
                            <div key={i} className="text-xs"><Badge variant="outline" className="text-[10px] mr-1">{c.codigo}</Badge>{c.descricao}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DECISORES / QSA */}
              {result.decisores && result.decisores.length > 0 && (
                <div className="bento-card">
                  <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" /> Decisores / Quadro Societário
                  </h3>
                  <div className="space-y-2">
                    {result.decisores.map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{d.nome}</p>
                          <p className="text-xs text-muted-foreground">{d.cargo}</p>
                        </div>
                        <div className="flex gap-2">
                          {result.company.email && (
                            <a href={`mailto:${result.company.email}`}
                              className="text-xs text-primary hover:underline flex items-center gap-1">
                              ✉ E-mail empresa
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3 p-2 bg-muted/30 rounded">
                    ℹ️ Contatos pessoais dos sócios não estão disponíveis na Receita Federal.
                    Use o enriquecimento via LinkedIn ou ferramentas como Apollo.io para e-mails individuais.
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
