import { useState, useMemo } from "react";
import { useUnit } from "@/contexts/UnitContext";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSearchLeads, CATEGORIA_LABELS, PORTARIA_TO_CATEGORIA } from "@/hooks/useLeads";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrgencyBadge, LeadScoreBadge } from "@/components/Badges";
import { Search, Loader2, Building2, MapPin, FileText, AlertCircle, Database, Globe, UserCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

function computeScoring(company: any, portaria: string) {
  const reasons: string[] = [];
  let score = 0;
  const allCnaes = [String(company.cnae_fiscal || company.cnae_principal || ""),
    ...(company.cnaes_secundarios?.map((c: any) => String(c.codigo || c)) ?? [])];
  if (company.situacao_cadastral === 2 || company.situacao_cadastral === "Ativa") { score += 20; reasons.push("Empresa ativa"); }
  if (company.email) { score += 10; reasons.push("E-mail disponível"); }
  if (company.telefone_1 || company.telefones?.length) { score += 10; reasons.push("Telefone disponível"); }
  if ((company.qsa || company.QSA)?.length > 0) { score += 10; reasons.push("Decisores identificados"); }
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

const PORTARIAS_LAB = [
  { value: "endotoxina", label: "Endotoxina & Esterilidade (Kevin)" },
  { value: "mri_iso10993", label: "MRI & ISO 10993/18 (Ana Beatriz)" },
];
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

const ESTADOS_BR = [
  { code: "SP", label: "São Paulo" }, { code: "RJ", label: "Rio de Janeiro" },
  { code: "MG", label: "Minas Gerais" }, { code: "RS", label: "Rio Grande do Sul" },
  { code: "PR", label: "Paraná" }, { code: "SC", label: "Santa Catarina" },
  { code: "BA", label: "Bahia" }, { code: "GO", label: "Goiás" },
  { code: "ES", label: "Espírito Santo" }, { code: "PE", label: "Pernambuco" },
  { code: "AM", label: "Amazonas" }, { code: "CE", label: "Ceará" },
  { code: "MT", label: "Mato Grosso" }, { code: "MS", label: "Mato Grosso do Sul" },
  { code: "DF", label: "Distrito Federal" }, { code: "PA", label: "Pará" },
];

export default function Prospeccao() {
  const { unit, unitLabel } = useUnit();
  const [searchTab, setSearchTab] = useState<"interno" | "externo">("interno");
  const [internalSearch, setInternalSearch] = useState("");
  const [selectedPortaria, setSelectedPortaria] = useState(unit === "lab" ? "endotoxina" : "145/2022");
  const [searchType, setSearchType] = useState<"cnpj" | "cnae" | "palavra">("cnpj");
  const [cnpjInput, setCnpjInput] = useState("");
  const [selectedCnae, setSelectedCnae] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("SP");
  const [keyword, setKeyword] = useState("");
  const [trigger, setTrigger] = useState<{ type: string; value: string; portaria: string; estado?: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [hideCertified, setHideCertified] = useState(false);

  // OCP cross-reference: load certified CNPJs from `certificados` table
  const { data: certificados } = useQuery({
    queryKey: ["certificados-cnpjs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificados").select("cnpj_empresa");
      if (error) throw error;
      return new Set((data || []).map((c: any) => (c.cnpj_empresa || "").replace(/\D/g, "")).filter(Boolean));
    },
    enabled: unit === "ocp",
  });
  const isCertified = (cnpj: string) => unit === "ocp" && certificados?.has((cnpj || "").replace(/\D/g, ""));

  const portarias = unit === "lab" ? PORTARIAS_LAB : PORTARIAS_OCP;
  const cnaes = unit === "lab" ? CNAES_LAB : CNAES_OCP;
  const categoriaKey = PORTARIA_TO_CATEGORIA[selectedPortaria];
  const { data: internalLeads, isLoading: internalLoading } = useSearchLeads(internalSearch, categoriaKey);

  // Busca por CNPJ — OpenCNPJ (gratuito, sem auth)
  const cnpjQuery = useQuery({
    queryKey: ["opencnpj", trigger],
    queryFn: async () => {
      const clean = trigger!.value.replace(/\D/g, "");
      const res = await fetch(`https://api.opencnpj.org/${clean}`);
      if (!res.ok) {
        // Fallback BrasilAPI
        const res2 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
        if (!res2.ok) throw new Error("CNPJ não encontrado");
        const d = await res2.json();
        return { company: d, scoring: computeScoring(d, trigger!.portaria), source: "BrasilAPI" };
      }
      const d = await res.json();
      return { company: d, scoring: computeScoring(d, trigger!.portaria), source: "OpenCNPJ" };
    },
    enabled: !!trigger && trigger.type === "cnpj",
    retry: 0,
    staleTime: 1000 * 60 * 30,
  });

  // Busca por CNAE — OpenCNPJ lista empresas por CNAE + UF
  const cnaeQuery = useQuery({
    queryKey: ["cnae-search", trigger],
    queryFn: async () => {
      const cnae = trigger!.value;
      const uf = trigger!.estado || "SP";
      // OpenCNPJ: busca por CNAE principal + UF
      const res = await fetch(`https://api.opencnpj.org/search?cnae_principal=${cnae}&uf=${uf}&situacao_cadastral=Ativa&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (data?.data?.length > 0) return { empresas: data.data, source: "OpenCNPJ", total: data.total };
      }
      // Fallback: CNPJá open API
      const res2 = await fetch(`https://open.cnpja.com/office?cnaes=${cnae}&uf=${uf}&limit=20`);
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2?.records?.length > 0) return { empresas: data2.records, source: "CNPJá", total: data2.total };
      }
      throw new Error(`Nenhuma empresa encontrada para este CNAE em ${uf}. Tente outro estado ou importe um CSV com CNPJs do setor.`);
    },
    enabled: !!trigger && trigger.type === "cnae",
    retry: 0,
    staleTime: 1000 * 60 * 30,
  });

  // Busca por palavra-chave + estado (fallback quando CNAE falha)
  const keywordQuery = useQuery({
    queryKey: ["keyword-search", trigger],
    queryFn: async () => {
      const q = trigger!.value;
      const uf = trigger!.estado || "SP";
      // OpenCNPJ search por razão social
      const res = await fetch(`https://api.opencnpj.org/search?razao_social=${encodeURIComponent(q)}&uf=${uf}&situacao_cadastral=Ativa&limit=20`);
      if (res.ok) {
        const d = await res.json();
        if (d?.data?.length > 0) return { empresas: d.data, source: "OpenCNPJ", total: d.total };
      }
      // Fallback CNPJá — busca por nome
      const res2 = await fetch(`https://open.cnpja.com/office?search=${encodeURIComponent(q)}&uf=${uf}&limit=20`);
      if (res2.ok) {
        const d2 = await res2.json();
        if (d2?.records?.length > 0) return { empresas: d2.records, source: "CNPJá", total: d2.total };
      }
      throw new Error(`Nenhuma empresa encontrada para "${q}" em ${uf}.`);
    },
    enabled: !!trigger && trigger.type === "palavra",
    retry: 0,
    staleTime: 1000 * 60 * 30,
  });

  const handleSearch = () => {
    if (searchType === "cnpj") {
      const clean = cnpjInput.replace(/\D/g, "");
      if (clean.length !== 14) { toast.error("CNPJ deve ter 14 dígitos"); return; }
      setTrigger({ type: "cnpj", value: clean, portaria: selectedPortaria });
    } else if (searchType === "cnae") {
      if (!selectedCnae) { toast.error("Selecione um CNAE"); return; }
      setTrigger({ type: "cnae", value: selectedCnae, portaria: selectedPortaria, estado: selectedEstado });
      toast.info(`Buscando empresas com CNAE ${selectedCnae} em ${selectedEstado}...`);
    } else {
      const k = keyword.trim();
      if (k.length < 3) { toast.error("Digite ao menos 3 caracteres"); return; }
      setTrigger({ type: "palavra", value: k, portaria: selectedPortaria, estado: selectedEstado });
      toast.info(`Buscando "${k}" em ${selectedEstado}...`);
    }
  };

  const handleSaveLead = async (empresa: any) => {
    const id = empresa.cnpj || empresa.office?.cnpj;
    setSavingId(id);
    try {
      const nome = empresa.razao_social || empresa.company?.name || empresa.office?.alias || "—";
      const email = empresa.email || empresa.company?.email || empresa.office?.phones?.[0]?.number || null;
      const tel = empresa.telefones?.[0] ? `(${empresa.telefones[0].ddd}) ${empresa.telefones[0].numero}` :
        empresa.office?.phones?.[0]?.number || null;
      const uf = empresa.uf || empresa.office?.address?.state || null;
      await supabase.from("leads").insert({
        empresa: nome,
        categoria: categoriaKey || "portaria_145_2022",
        contato_email: email,
        contato_telefone: tel,
        estado_negocio: "Novo Lead",
        etapa: "Prospecção",
        origem_lead: "busca_cnae",
        responsavel: portarias.find(p => p.value === selectedPortaria)?.label.split("(")[1]?.replace(")", "") || null,
        produtos: `CNAE: ${empresa.cnae_principal || empresa.cnae_fiscal}`,
        nacionalidade: uf,
      });
      toast.success(`${nome} adicionado ao CRM!`);
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingId(null); }
  };

  const isLoading = cnpjQuery.isFetching || cnaeQuery.isFetching || keywordQuery.isFetching;
  const cnpjResult = cnpjQuery.data;
  const cnaeResult = cnaeQuery.data || keywordQuery.data;

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  };

  const getEmail = (c: any) => c.email || null;
  const getTel = (c: any) => c.telefones?.[0] ? `(${c.telefones[0].ddd}) ${c.telefones[0].numero}` : c.ddd_telefone_1 ? `(${c.ddd_telefone_1}) ${c.telefone_1}` : null;
  const getSocios = (c: any) => c.QSA || c.qsa || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">{unit === "lab" ? "Prospecção — Laboratório" : "Prospecção — OCP"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Base interna + busca real de empresas · {unitLabel}</p>
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
          <TabsTrigger value="externo" className="flex-1 gap-2"><Globe className="h-4 w-4" />Busca Externa (Receita Federal)</TabsTrigger>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {l.contato_nome || "—"}
                        {l.contato_email && <div className="text-[10px] text-primary">{l.contato_email}</div>}
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
              <p className="text-sm text-muted-foreground">Nenhum lead encontrado</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearchTab("externo")}>
                <Globe className="h-4 w-4 mr-1" />Buscar novas empresas
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
            <h3 className="text-sm font-heading font-semibold mb-1">🌐 Buscar Novas Empresas — Receita Federal</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Dados oficiais via OpenCNPJ e CNPJá. Por CNPJ: dados completos + sócios. Por CNAE ou Palavra-chave: lista empresas ativas por estado.
            </p>
            <div className="flex gap-2 mb-4 flex-wrap">
              <Button variant={searchType === "cnpj" ? "default" : "outline"} size="sm" onClick={() => setSearchType("cnpj")}>
                <Building2 className="h-4 w-4 mr-1" />Por CNPJ
              </Button>
              <Button variant={searchType === "cnae" ? "default" : "outline"} size="sm" onClick={() => setSearchType("cnae")}>
                <FileText className="h-4 w-4 mr-1" />Por CNAE + Estado
              </Button>
              <Button variant={searchType === "palavra" ? "default" : "outline"} size="sm" onClick={() => setSearchType("palavra")}>
                <Search className="h-4 w-4 mr-1" />Palavra-chave + Estado
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {searchType === "cnpj" ? (
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">CNPJ da empresa</label>
                  <Input placeholder="00.000.000/0001-00" value={cnpjInput}
                    onChange={e => setCnpjInput(formatCnpj(e.target.value))}
                    onKeyDown={e => e.key === "Enter" && handleSearch()} />
                </div>
              ) : searchType === "cnae" ? (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">CNAE do setor</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedCnae} onChange={e => setSelectedCnae(e.target.value)}>
                      <option value="">Selecione...</option>
                      {cnaes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedEstado} onChange={e => setSelectedEstado(e.target.value)}>
                      {ESTADOS_BR.map(e => <option key={e.code} value={e.code}>{e.label}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Palavra-chave (razão social)</label>
                    <Input placeholder="Ex: laboratório, automotivo, hospital..."
                      value={keyword} onChange={e => setKeyword(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSearch()} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedEstado} onChange={e => setSelectedEstado(e.target.value)}>
                      {ESTADOS_BR.map(e => <option key={e.code} value={e.code}>{e.label}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="flex items-end">
                <Button onClick={handleSearch} disabled={isLoading} className="w-full gap-2">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isLoading ? "Buscando..." : "Buscar"}
                </Button>
              </div>
            </div>
          </div>

          {(cnpjQuery.error || cnaeQuery.error || keywordQuery.error) && (
            <div className="bento-card border-l-4 border-l-destructive">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{(cnpjQuery.error as Error)?.message || (cnaeQuery.error as Error)?.message || (keywordQuery.error as Error)?.message}</p>
                  {searchType === "cnae" && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      💡 Tente a busca por <strong>Palavra-chave + Estado</strong>, ou baixe listas em <a href="https://casadosdados.com.br" target="_blank" className="underline">casadosdados.com.br</a>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* RESULTADOS CNAE / PALAVRA-CHAVE */}
          {cnaeResult && (trigger?.type === "cnae" || trigger?.type === "palavra") && (() => {
            const visibleEmpresas = cnaeResult.empresas.filter((emp: any) => {
              if (!hideCertified) return true;
              const cnpj = emp.cnpj || emp.office?.cnpj || "";
              return !isCertified(cnpj);
            });
            const certifiedCount = cnaeResult.empresas.length - visibleEmpresas.length;
            return (
            <div className="bento-card">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-heading font-semibold">
                  🏭 Empresas encontradas — {cnaeResult.source}
                  {cnaeResult.total && <span className="text-muted-foreground font-normal ml-1">({cnaeResult.total} total)</span>}
                </h3>
                <div className="flex items-center gap-3">
                  {unit === "ocp" && (
                    <div className="flex items-center gap-2">
                      <Switch id="hide-cert" checked={hideCertified} onCheckedChange={setHideCertified} />
                      <Label htmlFor="hide-cert" className="text-xs cursor-pointer">
                        Ocultar já certificados {certifiedCount > 0 && `(${certifiedCount})`}
                      </Label>
                    </div>
                  )}
                  <Badge variant="secondary">{visibleEmpresas.length} exibidas</Badge>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Empresa</TableHead><TableHead>CNAE</TableHead>
                    <TableHead>Localização</TableHead><TableHead>Contato</TableHead>
                    <TableHead>Situação</TableHead><TableHead>Ação</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {visibleEmpresas.map((emp: any, i: number) => {
                      const nome = emp.razao_social || emp.company?.name || emp.office?.alias || "—";
                      const cnpj = emp.cnpj || emp.office?.cnpj || "—";
                      const email = emp.email || emp.company?.email || null;
                      const tel = emp.telefones?.[0] ? `(${emp.telefones[0].ddd}) ${emp.telefones[0].numero}` : null;
                      const cidade = emp.municipio || emp.office?.address?.city || "—";
                      const uf = emp.uf || emp.office?.address?.state || "—";
                      const situacao = emp.situacao_cadastral || "Ativa";
                      const cnaeCode = emp.cnae_principal || emp.cnae_fiscal;
                      const certified = isCertified(cnpj);
                      return (
                        <TableRow key={i} className={`hover:bg-muted/50 ${certified ? "bg-green-50/60" : ""}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{nome}</p>
                              {certified && <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] hover:bg-green-100">✓ Cliente Ativo</Badge>}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono">{cnpj}</p>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{cnaeCode}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{cidade}/{uf}</TableCell>
                          <TableCell className="text-xs">
                            {email ? <a href={`mailto:${email}`} className="text-primary hover:underline block">{email}</a> : <span className="text-muted-foreground">—</span>}
                            {tel && <span className="text-muted-foreground">{tel}</span>}
                          </TableCell>
                          <TableCell><Badge variant={situacao === "Ativa" ? "default" : "destructive"} className="text-xs">{situacao}</Badge></TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="text-xs h-7"
                              disabled={savingId === cnpj}
                              onClick={() => handleSaveLead(emp)}>
                              {savingId === cnpj ? <Loader2 className="h-3 w-3 animate-spin" /> : "+ CRM"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
            );
          })()}

          {/* RESULTADO CNPJ */}
          {cnpjResult && trigger?.type === "cnpj" && (
            <div className="space-y-4 animate-slide-up">
              <div className="bento-card-accent">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-heading font-semibold">📊 Lead Scoring — {cnpjResult.source}</h3>
                  </div>
                  <div className="flex gap-2">
                    <LeadScoreBadge score={cnpjResult.scoring.score} />
                    <UrgencyBadge urgency={cnpjResult.scoring.urgency} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cnpjResult.scoring.reasons.map((r, i) => <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>)}
                  {!cnpjResult.scoring.reasons.length && <span className="text-xs text-muted-foreground">Nenhum critério de portaria atendido</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bento-card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-heading font-semibold">🏢 Dados Cadastrais</h3>
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                      disabled={!!savingId}
                      onClick={() => handleSaveLead(cnpjResult.company)}>
                      {savingId ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      + Salvar no CRM
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Razão Social:</span> <span className="font-medium">{cnpjResult.company.razao_social || cnpjResult.company.company?.name}</span></div>
                    {cnpjResult.company.nome_fantasia && <div><span className="text-muted-foreground">Fantasia:</span> <span>{cnpjResult.company.nome_fantasia}</span></div>}
                    <div><span className="text-muted-foreground">CNPJ:</span> <span className="font-mono">{cnpjResult.company.cnpj}</span></div>
                    <div><span className="text-muted-foreground">Situação:</span> <Badge variant="default" className="text-xs">{cnpjResult.company.situacao_cadastral || cnpjResult.company.descricao_situacao_cadastral}</Badge></div>
                    <div className="flex gap-1"><MapPin className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                      <span>{cnpjResult.company.logradouro || cnpjResult.company.office?.address?.street}, {cnpjResult.company.municipio || cnpjResult.company.office?.address?.city}/{cnpjResult.company.uf || cnpjResult.company.office?.address?.state}</span>
                    </div>
                    {getEmail(cnpjResult.company) && <div><span className="text-muted-foreground">Email:</span> <a href={`mailto:${getEmail(cnpjResult.company)}`} className="text-primary hover:underline">{getEmail(cnpjResult.company)}</a></div>}
                    {getTel(cnpjResult.company) && <div><span className="text-muted-foreground">Tel:</span> <span>{getTel(cnpjResult.company)}</span></div>}
                    {cnpjResult.company.porte_empresa && <div><span className="text-muted-foreground">Porte:</span> <Badge variant="outline" className="text-xs">{cnpjResult.company.porte_empresa}</Badge></div>}
                    {cnpjResult.company.capital_social && <div><span className="text-muted-foreground">Capital Social:</span> <span className="text-xs">R$ {cnpjResult.company.capital_social}</span></div>}
                  </div>
                </div>
                <div className="bento-card">
                  <h3 className="text-sm font-heading font-semibold mb-3">📋 CNAEs</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Principal:</span> <Badge variant="outline" className="text-xs ml-1">{cnpjResult.company.cnae_fiscal || cnpjResult.company.cnae_principal}</Badge>
                      <p className="mt-1 text-xs">{cnpjResult.company.cnae_fiscal_descricao}</p>
                    </div>
                    {cnpjResult.company.cnaes_secundarios?.length > 0 && (
                      <div><span className="text-muted-foreground block mb-1">Secundários:</span>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {cnpjResult.company.cnaes_secundarios.slice(0, 8).map((c: any, i: number) => (
                            <div key={i} className="text-xs"><Badge variant="outline" className="text-[10px] mr-1">{c.codigo || c}</Badge>{c.descricao}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {getSocios(cnpjResult.company).length > 0 && (
                <div className="bento-card">
                  <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" /> Decisores / Sócios
                  </h3>
                  <div className="space-y-2">
                    {getSocios(cnpjResult.company).map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{s.nome_socio}</p>
                          <p className="text-xs text-muted-foreground">{s.qualificacao_socio}</p>
                        </div>
                        {getEmail(cnpjResult.company) && (
                          <a href={`mailto:${getEmail(cnpjResult.company)}`} className="text-xs text-primary hover:underline">✉ Contato</a>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(getSocios(cnpjResult.company)[0]?.nome_socio || "")}`}
                      target="_blank" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Buscar no LinkedIn
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
