import { useState } from "react";
import { useUnit } from "@/contexts/UnitContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UrgencyBadge, LeadScoreBadge } from "@/components/Badges";
import { Search, Loader2, Building2, MapPin, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  scoring: {
    score: number;
    urgency: string;
    reasons: string[];
  };
}

interface CnaeResult {
  cnae_info: {
    id: string;
    descricao: string;
    observacoes?: string[];
    atividades?: string[];
  };
}

const PORTARIAS_LAB = [
  { value: "145/2022", label: "Portaria 145/2022 — Produtos para Saúde" },
  { value: "384/2020", label: "Portaria 384/2020 — Automotivo" },
];

const PORTARIAS_OCP = [
  { value: "384/2020", label: "Portaria 384/2020 — Automotivo/Colchões" },
  { value: "145/2022", label: "Portaria 145/2022 — Produtos para Saúde" },
];

const CNAES_LAB = [
  { code: "3250701", label: "3250-7/01 — Instrumentos médico-cirúrgicos" },
  { code: "3250702", label: "3250-7/02 — Próteses e artigos ortopédicos" },
  { code: "3250706", label: "3250-7/06 — Material hospitalar" },
  { code: "2110600", label: "2110-6/00 — Produtos farmacêuticos" },
];

const CNAES_OCP = [
  { code: "2910701", label: "2910-7/01 — Automóveis e utilitários" },
  { code: "3104700", label: "3104-7/00 — Colchões" },
  { code: "3101200", label: "3101-2/00 — Móveis" },
  { code: "3240099", label: "3240-0/99 — Brinquedos" },
];

export default function Prospeccao() {
  const { unit, unitLabel } = useUnit();
  const [searchType, setSearchType] = useState<"cnpj" | "cnae">("cnpj");
  const [cnpjInput, setCnpjInput] = useState("");
  const [selectedCnae, setSelectedCnae] = useState("");
  const [selectedPortaria, setSelectedPortaria] = useState(
    unit === "lab" ? "145/2022" : "384/2020"
  );
  const [searchTrigger, setSearchTrigger] = useState<{
    type: string;
    value: string;
    portaria: string;
    unit: string;
  } | null>(null);

  const portarias = unit === "lab" ? PORTARIAS_LAB : PORTARIAS_OCP;
  const cnaes = unit === "lab" ? CNAES_LAB : CNAES_OCP;

  // CNPJ search query
  const cnpjQuery = useQuery<CompanyResult>({
    queryKey: ["search-cnpj", searchTrigger],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-cnpj", {
        body: {
          cnpj: searchTrigger!.value,
          portaria: searchTrigger!.portaria,
          unit: searchTrigger!.unit,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    enabled: !!searchTrigger && searchTrigger.type === "cnpj",
    retry: 1,
    staleTime: 1000 * 60 * 30, // 30min cache
  });

  // CNAE info query
  const cnaeQuery = useQuery<CnaeResult>({
    queryKey: ["search-cnae", searchTrigger],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-cnpj", {
        body: { cnae: searchTrigger!.value },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    enabled: !!searchTrigger && searchTrigger.type === "cnae",
    retry: 1,
    staleTime: 1000 * 60 * 60, // 1h cache
  });

  const handleSearch = () => {
    if (searchType === "cnpj") {
      const clean = cnpjInput.replace(/\D/g, "");
      if (clean.length !== 14) {
        toast.error("CNPJ deve ter 14 dígitos");
        return;
      }
      setSearchTrigger({ type: "cnpj", value: clean, portaria: selectedPortaria, unit });
    } else {
      if (!selectedCnae) {
        toast.error("Selecione um CNAE");
        return;
      }
      setSearchTrigger({ type: "cnae", value: selectedCnae, portaria: selectedPortaria, unit });
    }
  };

  const isLoading = cnpjQuery.isFetching || cnaeQuery.isFetching;
  const companyData = cnpjQuery.data;
  const cnaeData = cnaeQuery.data;

  const formatCnpj = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          {unit === "lab" ? "Prospecção INMETRO" : "Prospecção Portarias"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Busque leads por CNPJ ou CNAE · {unitLabel}
        </p>
      </div>

      {/* Search Panel */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
          🔍 Motor de Busca
        </h3>

        {/* Search type toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={searchType === "cnpj" ? "default" : "outline"}
            size="sm"
            onClick={() => setSearchType("cnpj")}
          >
            <Building2 className="h-4 w-4 mr-1" /> Por CNPJ
          </Button>
          <Button
            variant={searchType === "cnae" ? "default" : "outline"}
            size="sm"
            onClick={() => setSearchType("cnae")}
          >
            <FileText className="h-4 w-4 mr-1" /> Por CNAE
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Input */}
          {searchType === "cnpj" ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ</label>
              <Input
                placeholder="00.000.000/0001-00"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(formatCnpj(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNAE</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedCnae}
                onChange={(e) => setSelectedCnae(e.target.value)}
              >
                <option value="">Selecione um CNAE...</option>
                {cnaes.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Portaria */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Portaria</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedPortaria}
              onChange={(e) => setSelectedPortaria(e.target.value)}
            >
              {portarias.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Search button */}
          <div className="flex items-end">
            <Button onClick={handleSearch} disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
          </div>
        </div>
      </div>

      {/* Error State */}
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

      {/* CNPJ Result */}
      {companyData && (
        <div className="space-y-4 animate-slide-up">
          {/* Scoring Card */}
          <div className="bento-card-accent">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-heading font-semibold text-foreground">
                📊 Lead Scoring Automático
              </h3>
              <div className="flex items-center gap-2">
                <LeadScoreBadge score={companyData.scoring.score} />
                <UrgencyBadge urgency={companyData.scoring.urgency} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {companyData.scoring.reasons.map((r, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {r}
                </Badge>
              ))}
              {companyData.scoring.reasons.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhum critério atendido</span>
              )}
            </div>
          </div>

          {/* Company Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bento-card">
              <h3 className="text-sm font-heading font-semibold text-foreground mb-3">
                🏢 Dados Cadastrais
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Razão Social:</span>{" "}
                  <span className="font-medium text-foreground">{companyData.company.razao_social}</span>
                </div>
                {companyData.company.nome_fantasia && (
                  <div>
                    <span className="text-muted-foreground">Nome Fantasia:</span>{" "}
                    <span className="text-foreground">{companyData.company.nome_fantasia}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">CNPJ:</span>{" "}
                  <span className="font-mono text-foreground">{companyData.company.cnpj}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Situação:</span>{" "}
                  <Badge variant={companyData.company.situacao_cadastral === 2 ? "default" : "destructive"} className="text-xs">
                    {companyData.company.descricao_situacao_cadastral}
                  </Badge>
                </div>
                <div className="flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-1 text-muted-foreground" />
                  <span className="text-foreground">
                    {companyData.company.logradouro}, {companyData.company.municipio}/{companyData.company.uf}
                  </span>
                </div>
                {companyData.company.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <span className="text-foreground">{companyData.company.email}</span>
                  </div>
                )}
                {companyData.company.telefone_1 && (
                  <div>
                    <span className="text-muted-foreground">Telefone:</span>{" "}
                    <span className="text-foreground">{companyData.company.telefone_1}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bento-card">
              <h3 className="text-sm font-heading font-semibold text-foreground mb-3">
                📋 Atividades Econômicas
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">CNAE Principal:</span>{" "}
                  <Badge variant="outline" className="text-xs">
                    {companyData.company.cnae_fiscal}
                  </Badge>
                  <p className="text-foreground mt-1">{companyData.company.cnae_fiscal_descricao}</p>
                </div>
                {companyData.company.cnaes_secundarios && companyData.company.cnaes_secundarios.length > 0 && (
                  <div>
                    <span className="text-muted-foreground block mb-1">CNAEs Secundários:</span>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {companyData.company.cnaes_secundarios.slice(0, 10).map((c, i) => (
                        <div key={i} className="text-xs text-foreground">
                          <Badge variant="outline" className="text-[10px] mr-1">{c.codigo}</Badge>
                          {c.descricao}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* QSA (Sócios) */}
          {companyData.company.qsa && companyData.company.qsa.length > 0 && (
            <div className="bento-card">
              <h3 className="text-sm font-heading font-semibold text-foreground mb-3">
                👥 Quadro Societário (Decisores)
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Qualificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyData.company.qsa.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-foreground">{s.nome_socio}</TableCell>
                      <TableCell className="text-muted-foreground">{s.qualificacao_socio}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* CNAE Result */}
      {cnaeData && (
        <div className="bento-card animate-slide-up">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">
            📑 Informações do CNAE {cnaeData.cnae_info.id}
          </h3>
          <p className="text-sm text-foreground mb-2">{cnaeData.cnae_info.descricao}</p>
          {cnaeData.cnae_info.atividades && cnaeData.cnae_info.atividades.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Atividades incluídas:</span>
              <ul className="list-disc list-inside text-xs text-foreground space-y-0.5">
                {cnaeData.cnae_info.atividades.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!searchTrigger && !isLoading && (
        <div className="bento-card text-center py-12">
          <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Use o motor de busca acima para encontrar leads por CNPJ ou CNAE
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            O scoring automático classificará cada lead em Hot, Médio ou Normal
          </p>
        </div>
      )}
    </div>
  );
}
