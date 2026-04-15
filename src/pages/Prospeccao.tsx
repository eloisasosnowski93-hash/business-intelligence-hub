import { useState } from "react";
import { useUnit } from "@/contexts/UnitContext";
import { useQuery } from "@tanstack/react-query";
import { useSearchLeads, CATEGORIA_LABELS, PORTARIA_TO_CATEGORIA } from "@/hooks/useLeads";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrgencyBadge, LeadScoreBadge } from "@/components/Badges";
import { Search, Loader2, Building2, MapPin, FileText, AlertCircle, Database, Globe } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CompanyResult {
  company: {
    cnpj: string;
    razao_social: string;
    nome_fantasia: string;
    cnae_fiscal: number;
    cnae_fiscal_descricao: string;
    logradouro: string;
    municipio: string;
    uf: string;
    cep: string;
    telefone_1: string;
    email: string;
    situacao_cadastral: number;
    descricao_situacao_cadastral: string;
    qsa?: Array<{ nome_socio: string; qualificacao_socio: string }>;
    cnaes_secundarios?: Array<{ codigo: number; descricao: string }>;
  };
  scoring: { score: number; urgency: string; reasons: string[] };
}

function computeScoring(company: any, portaria: string) {
  const reasons: string[] = [];
  let score = 0;
  const cnae = String(company.cnae_fiscal);
  const allCnaes = [cnae, ...(company.cnaes_secundarios?.map((c: any) => String(c.codigo)) ?? [])];

  if (company.situacao_cadastral === 2) { score += 20; reasons.push("Empresa ativa na Receita Federal"); }
  if (company.email) { score += 10; reasons.push("E-mail disponível"); }
  if (company.telefone_1) { score += 10; reasons.push("Telefone disponível"); }

  if (portaria === "145/2022") {
    const auto = ["2910", "2920", "2930", "2941", "2942", "2949", "4511", "4530"];
    if (allCnaes.some(c => auto.some(a => c.startsWith(a)))) {
      score += 40; reasons.push("CNAE automotivo — elegível Portaria 145/2022");
    }
  }
  if (portaria === "384/2020") {
    const sanit = ["3250", "2660", "3841", "3842", "2651", "2652"];
    if (allCnaes.some(c => sanit.some(a => c.startsWith(a)))) {
      score += 40; reasons.push("CNAE equip. médico/sanitário — elegível Portaria 384/2020");
    }
  }
  if (portaria === "endotoxina") {
    const pharma = ["2110", "2121", "2122", "2123", "2130", "3250"];
    if (allCnaes.some(c => pharma.some(a => c.startsWith(a)))) {
      score += 40; reasons.push("CNAE farmacêutico/médico — demanda ensaios endotoxina");
    }
  }
  if (portaria === "mri_iso10993") {
    const bio = ["3250", "2660", "2670", "2680"];
    if (allCnaes.some(c => bio.some(a => c.startsWith(a)))) {
      score += 40; reasons.push("CNAE dispositivos médicos — elegível ISO 10993");
    }
  }

  const urgency = score >= 60 ? "alta" : score >= 30 ? "media" : "baixa";
  return { score, urgency, reasons };
}

const PORTARIAS_LAB = [
  { value: "145/2022", label: "Portaria 145/2022 — Automotivo (Eloisa)" },
  { value: "endotoxina", label: "Endotoxina & Esterilidade (Kevin)" },
  { value: "mri_iso10993", label: "MRI & ISO 10993/18 (Ana Beatriz)" },
];

const PORTARIAS_OCP = [
  { value: "384/2020", label: "Portaria 384/2020 — Equip. Vigilância Sanitária (Ana Carolina)" },
  { value: "145/2022", label: "Portaria 145/2022 — Componentes Automotivos (Eloisa)" },
];

const CNAES_LAB = [
  { code: "3250701", label: "3250-7/01 — Instrumentos médico-cirúrgicos" },
  { code: "3250706", label: "3250-7/06 — Material hospitalar" },
  { code: "2660400", label: "2660-4/00 — Aparelhos eletromédicos e de diagnóstico" },
  { code: "2651500", label: "2651-5/00 — Aparelhos e instrumentos de medida" },
  { code: "2110600", label: "2110-6/00 — Fabricação de produtos farmacêuticos" },
  { code: "2121101", label: "2121-1/01 — Medicamentos para uso humano" },
  { code: "2123800", label: "2123-8/00 — Preparações farmacêuticas" },
  { code: "3250709", label: "3250-7/09 — Outros equipamentos e instrumentos médicos" },
];

const CNAES_OCP = [
  { code: "2910701", label: "2910-7/01 — Automóveis e utilitários (Port. 145/2022)" },
  { code: "2941700", label: "2941-7/00 — Peças p/ sistema motor veicular" },
  { code: "2942500", label: "2942-5/00 — Peças p/ sistema de transmissão" },
  { code: "2949299", label: "2949-2/99 — Outras peças e acessórios automotivos" },
  { code: "3250701", label: "3250-7/01 — Equipamentos médico-cirúrgicos (Port. 384/2020)" },
  { code: "2660400", label: "2660-4/00 — Aparelhos eletromédicos (Port. 384/2020)" },
  { code: "2710401", label: "2710-4/01 — Motores e geradores elétricos" },
  { code: "2740601", label: "2740-6/01 — Lâmpadas" },
];

export default function Prospeccao() {
  const { unit, unitLabel } = useUnit();
  const [searchTab, setSearchTab] = useState<"interno" | "externo">("interno");
  const [internalSearch, setInternalSearch] = useState("");
  const [selectedPortaria, setSelectedPortaria] = useState(unit === "lab" ? "145/2022" : "384/2020");
  const [searchType, setSearchType] = useState<"cnpj" | "cnae">("cnpj");
  const [cnpjInput, setCnpjInput] = useState("");
  const [selectedCnae, setSelectedCnae] = useState("");
  const [trigger, setTrigger] = useState<{ type: string; value: string; portaria: string } | null>(null);

  const portarias = unit === "lab" ? PORTARIAS_LAB : PORTARIAS_OCP;
  const cnaes = unit === "lab" ? CNAES_LAB : CNAES_OCP;
  const categoriaKey = PORTARIA_TO_CATEGORIA[selectedPortaria];

  const { data: internalLeads, isLoading: internalLoading } = useSearchLeads(internalSearch, categoriaKey);

  // ✅ CNPJ: BrasilAPI direto, sem Edge Function
  const cnpjQuery = useQuery<CompanyResult>({
    queryKey: ["brasilapi-cnpj", trigger],
    queryFn: async () => {
      const clean = trigger!.value.replace(/\D/g, "");
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `CNPJ não encontrado (status ${res.status})`);
      }
      const company = await res.json();
      const scoring = computeScoring(company, trigger!.portaria);
      return { company, scoring };
    },
    enabled: !!trigger && trigger.type === "cnpj",
    retry: 0,
    staleTime: 1000 * 60 * 30,
  });

  // ✅ CNAE: busca interna + info do CNAE via BrasilAPI
  const cnaeQuery = useQuery({
    queryKey: ["brasilapi-cnae", trigger],
    queryFn: async () => {
      const res = await fetch(`https://brasilapi.com.br/api/cnae/v2/${trigger!.value}`);
      if (!res.ok) throw new Error("CNAE não encontrado");
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
  const companyData = cnpjQuery.data;

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          {unit === "lab" ? "Prospecção — Laboratório" : "Prospecção — OCP"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Busca híbrida: base interna + BrasilAPI · {unitLabel}</p>
      </div>

      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3">📋 Filtrar por Portaria / Categoria</h3>
        <div className="flex flex-wrap gap-2">
          {portarias.map((p) => (
            <Button key={p.value} variant={selectedPortaria === p.value ? "default" : "outline"} size="sm"
              onClick={() => setSelectedPortaria(p.value)} className="text-xs">{p.label}</Button>
          ))}
        </div>
      </div>

      <Tabs value={searchTab} onValueChange={(v) => setSearchTab(v as "interno" | "externo")}>
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="interno" className="flex-1 gap-2"><Database className="h-4 w-4" /> Base Interna (CRM)</TabsTrigger>
          <TabsTrigger value="externo" className="flex-1 gap-2"><Globe className="h-4 w-4" /> Busca Externa (BrasilAPI)</TabsTrigger>
        </TabsList>

        <TabsContent value="interno" className="space-y-4">
          <div className="bento-card">
            <h3 className="text-sm font-heading font-semibold mb-3">🔍 Buscar na Base de Leads Conhecidos</h3>
            <div className="flex gap-3">
              <Input placeholder="Buscar empresa, contato, produto..." value={internalSearch}
                onChange={(e) => setInternalSearch(e.target.value)} className="flex-1" />
              {internalLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-2" />}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Filtrando por: <strong>{CATEGORIA_LABELS[categoriaKey] || selectedPortaria}</strong>
              {internalLeads && ` · ${internalLeads.length} leads`}
            </p>
          </div>

          {internalLeads && internalLeads.length > 0 && (
            <div className="bento-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Negócio</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {internalLeads.slice(0, 50).map((l) => (
                    <TableRow key={l.id} className="hover:bg-muted/50">
                      <TableCell>
                        <p className="font-medium text-sm">{l.empresa}</p>
                        {l.produtos && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{l.produtos}</p>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.nome_negocio || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.etapa || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={l.estado_negocio === "Vendida" ? "default" : l.estado_negocio === "Perdida" ? "destructive" : "secondary"} className="text-xs">
                          {l.estado_negocio || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.contato_nome || "—"}
                        {l.contato_email && <div className="text-[10px]">{l.contato_email}</div>}
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
                <Globe className="h-4 w-4 mr-1" /> Buscar externamente via BrasilAPI
              </Button>
            </div>
          )}

          {(!internalLeads || internalLeads.length === 0) && internalSearch.length < 2 && (
            <div className="bento-card text-center py-12">
              <Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres para buscar</p>
              <p className="text-xs text-muted-foreground mt-1">Ou use "Busca Externa" para consultar CNPJs via BrasilAPI</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="externo" className="space-y-4">
          <div className="bento-card">
            <h3 className="text-sm font-heading font-semibold mb-4">🌐 Busca Externa — BrasilAPI (gratuito, sem chave)</h3>
            <div className="flex gap-2 mb-4">
              <Button variant={searchType === "cnpj" ? "default" : "outline"} size="sm" onClick={() => setSearchType("cnpj")}>
                <Building2 className="h-4 w-4 mr-1" /> Por CNPJ
              </Button>
              <Button variant={searchType === "cnae" ? "default" : "outline"} size="sm" onClick={() => setSearchType("cnae")}>
                <FileText className="h-4 w-4 mr-1" /> Por CNAE
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchType === "cnpj" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ da empresa</label>
                  <Input placeholder="00.000.000/0001-00" value={cnpjInput}
                    onChange={(e) => setCnpjInput(formatCnpj(e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">CNAE</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCnae} onChange={(e) => setSelectedCnae(e.target.value)}>
                    <option value="">Selecione um CNAE...</option>
                    {cnaes.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">Retorna a descrição oficial do CNAE. Para buscar empresas por CNAE, use o upload de CSV na seção CRM.</p>
                </div>
              )}
              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar
                </Button>
              </div>
            </div>
          </div>

          {(cnpjQuery.error || cnaeQuery.error) && (
            <div className="bento-card border-l-4 border-l-destructive">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm font-medium">
                  {(cnpjQuery.error as Error)?.message || (cnaeQuery.error as Error)?.message}
                </p>
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
              <p className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-md">
                💡 Para buscar <strong>empresas</strong> com este CNAE, importe uma planilha com CNPJs na seção <strong>CRM Leads</strong>. O sistema cruzará automaticamente.
              </p>
            </div>
          )}

          {companyData && (
            <div className="space-y-4 animate-slide-up">
              <div className="bento-card-accent">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-heading font-semibold">📊 Lead Scoring Automático</h3>
                  <div className="flex items-center gap-2">
                    <LeadScoreBadge score={companyData.scoring.score} />
                    <UrgencyBadge urgency={companyData.scoring.urgency} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {companyData.scoring.reasons.map((r, i) => <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>)}
                  {companyData.scoring.reasons.length === 0 && <span className="text-xs text-muted-foreground">Nenhum critério de portaria atendido</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bento-card">
                  <h3 className="text-sm font-heading font-semibold mb-3">🏢 Dados Cadastrais</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Razão Social:</span> <span className="font-medium">{companyData.company.razao_social}</span></div>
                    {companyData.company.nome_fantasia && <div><span className="text-muted-foreground">Nome Fantasia:</span> <span>{companyData.company.nome_fantasia}</span></div>}
                    <div><span className="text-muted-foreground">CNPJ:</span> <span className="font-mono">{companyData.company.cnpj}</span></div>
                    <div>
                      <span className="text-muted-foreground">Situação:</span>{" "}
                      <Badge variant={companyData.company.situacao_cadastral === 2 ? "default" : "destructive"} className="text-xs">
                        {companyData.company.descricao_situacao_cadastral}
                      </Badge>
                    </div>
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-1 text-muted-foreground" />
                      <span>{companyData.company.logradouro}, {companyData.company.municipio}/{companyData.company.uf}</span>
                    </div>
                    {companyData.company.email && <div><span className="text-muted-foreground">Email:</span> <span>{companyData.company.email}</span></div>}
                    {companyData.company.telefone_1 && <div><span className="text-muted-foreground">Telefone:</span> <span>{companyData.company.telefone_1}</span></div>}
                  </div>
                </div>

                <div className="bento-card">
                  <h3 className="text-sm font-heading font-semibold mb-3">📋 Atividades Econômicas</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">CNAE Principal:</span>{" "}
                      <Badge variant="outline" className="text-xs">{companyData.company.cnae_fiscal}</Badge>
                      <p className="mt-1">{companyData.company.cnae_fiscal_descricao}</p>
                    </div>
                    {companyData.company.cnaes_secundarios && companyData.company.cnaes_secundarios.length > 0 && (
                      <div>
                        <span className="text-muted-foreground block mb-1">CNAEs Secundários:</span>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {companyData.company.cnaes_secundarios.slice(0, 10).map((c, i) => (
                            <div key={i} className="text-xs">
                              <Badge variant="outline" className="text-[10px] mr-1">{c.codigo}</Badge>{c.descricao}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {companyData.company.qsa && companyData.company.qsa.length > 0 && (
                <div className="bento-card">
                  <h3 className="text-sm font-heading font-semibold mb-3">👥 Quadro Societário</h3>
                  <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Qualificação</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {companyData.company.qsa.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.nome_socio}</TableCell>
                          <TableCell className="text-muted-foreground">{s.qualificacao_socio}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
