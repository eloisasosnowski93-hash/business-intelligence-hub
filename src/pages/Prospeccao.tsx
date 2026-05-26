/**
 * Prospecção OCP — Motor de Inteligência de Mercado
 * ─────────────────────────────────────────────────
 * Arquitetura:
 *  - Sem abas "Base Interna / Receita Federal" — método novo unificado
 *  - Claude API como cérebro de análise e enriquecimento de leads
 *  - Portarias OCP: 145/2022, 384/2020, 501/2021, 071/2022
 *  - Cross-reference automático com tabela `certificados` (Supabase)
 *  - Score de criticidade por proximidade de vencimento
 */

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck, ShieldAlert, ShieldX,
  Target, Loader2, Sparkles, CalendarClock,
  Building2, MapPin, AlertTriangle, CheckCircle2,
  ArrowRight, FileSearch, BrainCircuit, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useMonitoredPortarias } from "@/hooks/useMonitoredPortarias";

// ─── Constants ───────────────────────────────────────────────────────────────

const PORTARIAS_OCP = [
  {
    value: "145/2022",
    numero: "145",
    label: "Portaria 145/2022",
    desc: "Componentes Automotivos",
    resp: "Eloisa",
    cnaes: ["2910", "2920", "2930", "2941", "2942", "2949", "4511", "4530"],
  },
  {
    value: "384/2020",
    numero: "384",
    label: "Portaria 384/2020",
    desc: "Equip. Vigilância Sanitária",
    resp: "Ana Carolina",
    cnaes: ["3250", "2660", "3841", "3842", "2651", "2652"],
  },
  {
    value: "501/2021",
    numero: "501",
    label: "Portaria 501/2021",
    desc: "Rodas",
    resp: "Eloisa",
    cnaes: ["2941", "2942", "2949"],
  },
  {
    value: "071/2022",
    numero: "071",
    label: "Portaria 071/2022",
    desc: "Outros / Geral",
    resp: "Eloisa",
    cnaes: [] as string[],
  },
] as const;

type PortariaValue = (typeof PORTARIAS_OCP)[number]["value"];

function diasParaVencer(dateStr: string): number {
  return Math.ceil(
    (new Date(dateStr + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
}

function criticidadeLabel(dias: number) {
  if (dias < 0)    return { label: "Vencido",          color: "bg-red-200 text-red-900",       dot: "bg-red-600" };
  if (dias <= 30)  return { label: `${dias}d — URGENTE`, color: "bg-red-100 text-red-700",     dot: "bg-red-500" };
  if (dias <= 90)  return { label: `${dias}d restantes`, color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500" };
  if (dias <= 180) return { label: `${dias}d restantes`, color: "bg-yellow-50 text-yellow-700", dot: "bg-yellow-400" };
  return             { label: `${dias}d restantes`, color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface AILead {
  id: string;
  empresa: string;
  cnpj?: string;
  cidade?: string;
  uf?: string;
  cnae?: string;
  contato?: string;
  email?: string;
  telefone?: string;
  motivo: string;
  score: number;
  portaria: string;
  certStatus: "sem_cert" | "vencendo" | "ativo" | "desconhecido";
  diasVencimento?: number;
  ocp_atual?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CertBadge({ status, dias }: { status: AILead["certStatus"]; dias?: number }) {
  if (status === "ativo") return (
    <Badge className="gap-1 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
      <ShieldCheck className="h-3 w-3" /> Cliente Scitec
    </Badge>
  );
  if (status === "vencendo") return (
    <Badge className="gap-1 text-[10px] bg-orange-100 text-orange-700 border-orange-200">
      <ShieldAlert className="h-3 w-3" /> Vence em {dias}d
    </Badge>
  );
  if (status === "sem_cert") return (
    <Badge className="gap-1 text-[10px] bg-slate-100 text-slate-600 border-slate-200">
      <ShieldX className="h-3 w-3" /> Sem certificação
    </Badge>
  );
  return (
    <Badge className="gap-1 text-[10px] bg-blue-50 text-blue-600 border-blue-200">
      <FileSearch className="h-3 w-3" /> A verificar
    </Badge>
  );
}

function ScoreDot({ score }: { score: number }) {
  const color = score >= 7 ? "text-red-600" : score >= 4 ? "text-amber-600" : "text-slate-400";
  const label = score >= 7 ? "🔥" : score >= 4 ? "⏳" : "➕";
  return (
    <div className={`text-center ${color}`}>
      <div className="text-sm">{label}</div>
      <div className="text-[10px] font-bold">{score}/10</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Prospeccao() {
  const [selectedPortaria, setSelectedPortaria] = useState<PortariaValue>("145/2022");
  const [comando, setComando] = useState("");
  const [aiLeads, setAiLeads] = useState<AILead[]>([]);
  const [isHunting, setIsHunting] = useState(false);
  const [huntLog, setHuntLog] = useState<string[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"todos" | "sem_cert" | "vencendo" | "ativo">("todos");

  const { portarias: monitored } = useMonitoredPortarias();
  const queryClient = useQueryClient();
  const portariaInfo = PORTARIAS_OCP.find((p) => p.value === selectedPortaria)!;

  // ── Alvos de renovação da base ────────────────────────────────────────────
  const { data: certAlvos = [], isLoading: certLoading } = useQuery({
    queryKey: ["cert-alvos", selectedPortaria],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificados")
        .select("id, numero_certificado, cnpj_empresa, razao_social, data_validade, portaria")
        .order("data_validade", { ascending: true });
      if (error) throw error;
      return (data || []).map((c) => ({ ...c, dias: diasParaVencer(c.data_validade) }));
    },
  });

  const { data: certSet = new Set<string>() } = useQuery({
    queryKey: ["cert-cnpj-set"],
    queryFn: async () => {
      const { data } = await supabase.from("certificados").select("cnpj_empresa");
      const s = new Set<string>();
      for (const c of data ?? []) {
        if (c.cnpj_empresa) s.add(c.cnpj_empresa.replace(/\D/g, ""));
      }
      return s;
    },
  });

  const critCount = certAlvos.filter((c) => c.dias <= 90).length;

  // ── Motor IA ──────────────────────────────────────────────────────────────
  const addLog = (msg: string) => setHuntLog((prev) => [...prev.slice(-4), msg]);

  const handleHunt = async () => {
    if (!comando.trim()) { toast.error("Descreva o que você quer prospectar"); return; }
    setIsHunting(true);
    setAiLeads([]);
    setHuntLog([]);
    try {
      addLog("🔍 Analisando contexto OCP...");
      const critAlvos = certAlvos.filter((c) => c.dias <= 90);
      const certContext = critAlvos.slice(0, 8).map((c) =>
        `${c.razao_social || c.cnpj_empresa || "—"} | Vence: ${c.dias < 0 ? "VENCIDO" : c.dias + "d"}`
      ).join("\n");

      addLog("🧠 Motor de inteligência processando...");

      const systemPrompt = `Você é o Hunter OCP da Scitec Certificações — especialista em prospecção de empresas para certificação OCP junto ao INMETRO.

PORTARIA ATIVA: ${portariaInfo.label} — ${portariaInfo.desc}
CNAEs principais: ${portariaInfo.cnaes.join(", ") || "variados"}
Responsável Scitec: ${portariaInfo.resp}

CERTIFICADOS CRÍTICOS NA BASE (≤ 90 dias):
${certContext || "Nenhum certificado crítico na base."}

REGRAS:
1. Gere 5-8 leads estratégicos e plausíveis para o setor
2. Priorize empresas com certificado vencendo ou sem certificação
3. Identifique se empresa pode estar com OUTRA OCP concorrente
4. Score 0-10: CNAE correto +4, empresa ativa +2, contato disponível +2, cert vencendo +2
5. motivo: UMA frase estratégica sobre por que abordar agora

RESPONDA APENAS JSON VÁLIDO, sem markdown:
{"analise":"string","leads":[{"id":"uuid","empresa":"string","cnpj":"string|null","cidade":"string","uf":"string","cnae":"string","contato":"string|null","email":"string|null","telefone":"string|null","motivo":"string","score":number,"portaria":"${portariaInfo.value}","certStatus":"sem_cert|vencendo|ativo|desconhecido","diasVencimento":number|null,"ocp_atual":"string|null"}]}`;

      const { data: fnData, error: fnError } = await supabase.functions.invoke("hunt-leads-ocp", {
        body: { systemPrompt, comando },
      });

      if (fnError) throw new Error(fnError.message || "Falha na comunicação com o motor");
      if (fnData?.error) throw new Error(fnData.error);
      addLog("📊 Processando alvos...");

      const rawText = fnData?.text || "{}";
      let parsed: { analise?: string; leads?: AILead[] };
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch {
        throw new Error("Resposta do motor inválida — tente reformular o comando");
      }

      const leads = (parsed.leads || []).map((l: AILead) => {
        const cnpjClean = (l.cnpj || "").replace(/\D/g, "");
        let certStatus = l.certStatus || "desconhecido";
        if (cnpjClean.length === 14 && certSet.has(cnpjClean)) certStatus = "ativo";
        return { ...l, certStatus } as AILead;
      });

      addLog(`✅ ${leads.length} alvos mapeados`);
      if (parsed.analise) toast.success(parsed.analise, { duration: 7000 });
      setAiLeads(leads.sort((a, b) => b.score - a.score));
    } catch (err: any) {
      toast.error(err.message || "Erro no motor");
      addLog("❌ " + (err.message || "Erro desconhecido"));
    } finally {
      setIsHunting(false);
    }
  };

  const handleSaveLead = async (lead: AILead) => {
    setSavingId(lead.id);
    try {
      await supabase.from("leads").insert({
        empresa: lead.empresa,
        categoria: `portaria_${portariaInfo.numero}`,
        contato_email: lead.email || null,
        contato_telefone: lead.telefone || null,
        contato_nome: lead.contato || null,
        estado_negocio: "Novo Lead",
        etapa: "Prospecção",
        origem_lead: "motor_ia_ocp",
        responsavel: portariaInfo.resp,
        produtos: `Portaria: ${lead.portaria} | CNAE: ${lead.cnae || "—"} | Score: ${lead.score}/10`,
        nacionalidade: lead.uf || null,
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${lead.empresa} adicionado ao CRM OCP!`);
      setAiLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const filteredLeads = useMemo(() => {
    if (filterStatus === "todos") return aiLeads;
    return aiLeads.filter((l) => l.certStatus === filterStatus);
  }, [aiLeads, filterStatus]);

  const monInfo = monitored.find((m) => m.numero === portariaInfo.numero);

  const quickCommands = [
    `Empresas de ${portariaInfo.desc.toLowerCase()} em SP com cert. vencendo`,
    `Fabricantes sem certificação OCP na região Sul`,
    `Empresas com OCP concorrente que posso abordar`,
    `Maiores fabricantes do setor para ${portariaInfo.label}`,
  ];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Prospecção OCP</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Motor de Inteligência de Mercado · Scitec Certificações
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge className="text-xs px-3 py-1 bg-blue-900 text-white border-0">
            <ShieldCheck className="h-3 w-3 mr-1" /> SCITEC OCP
          </Badge>
          {critCount > 0 && (
            <Badge className="text-xs px-3 py-1 bg-red-100 text-red-700 border-red-200">
              <AlertTriangle className="h-3 w-3 mr-1" /> {critCount} críticos
            </Badge>
          )}
        </div>
      </div>

      {/* Portaria Selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {PORTARIAS_OCP.map((p) => {
          const mon = monitored.find((m) => m.numero === p.numero);
          const isActive = selectedPortaria === p.value;
          return (
            <button
              key={p.value}
              onClick={() => setSelectedPortaria(p.value)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                isActive
                  ? "border-blue-800 bg-blue-900 shadow-lg shadow-blue-900/20"
                  : "border-border bg-card hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              {mon && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <div className={`text-xs font-bold mb-0.5 ${isActive ? "text-white" : "text-foreground"}`}>
                {p.label}
              </div>
              <div className={`text-[11px] leading-snug ${isActive ? "text-blue-200" : "text-muted-foreground"}`}>
                {p.desc}
              </div>
              <div className={`text-[10px] mt-1.5 font-medium ${isActive ? "text-blue-300" : "text-muted-foreground/70"}`}>
                Resp: {p.resp}
              </div>
              {mon?.criticos ? (
                <div className={`text-[10px] mt-1 font-semibold ${isActive ? "text-red-300" : "text-red-600"}`}>
                  ⚠ {mon.criticos} crítico{mon.criticos > 1 ? "s" : ""}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Alvos de Renovação */}
      {certAlvos.length > 0 && (
        <div className="bento-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-heading font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Alvos de Renovação — base Scitec
            </h3>
            <div className="flex items-center gap-2">
              {certLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              <Badge variant="secondary" className="text-xs">{certAlvos.length} cert.</Badge>
              {critCount > 0 && (
                <Badge className="text-xs bg-red-100 text-red-700 border-red-200">{critCount} ≤ 90d</Badge>
              )}
            </div>
          </div>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {certAlvos.map((c, i) => {
              const crit = criticidadeLabel(c.dias);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    c.dias < 0 ? "bg-red-100 border border-red-200" :
                    c.dias <= 90 ? "bg-amber-50 border border-amber-100" :
                    "bg-muted/40 border border-transparent"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0 font-mono">#{i+1}</span>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${crit.dot}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate block text-xs">
                      {c.razao_social || c.cnpj_empresa || c.numero_certificado}
                    </span>
                    {c.cnpj_empresa && (
                      <span className="text-[10px] text-muted-foreground font-mono">{c.cnpj_empresa}</span>
                    )}
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${crit.color}`}>{crit.label}</Badge>
                  <button
                    onClick={() => setComando(`Análise estratégica para renovação: ${c.razao_social || c.cnpj_empresa}`)}
                    className="shrink-0 text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                  >
                    <Zap className="h-3 w-3" /> analisar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Motor de Inteligência */}
      <div className="bento-card border-2 border-blue-100 bg-gradient-to-br from-blue-50/40 to-card">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-900 flex items-center justify-center shrink-0">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-heading font-semibold text-foreground">
              Motor de Inteligência OCP
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descreva o perfil de empresa, setor ou estratégia. O motor mapeia os melhores alvos para a {portariaInfo.label}.
            </p>
          </div>
        </div>

        {/* Quick commands */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {quickCommands.map((q, i) => (
            <button
              key={i}
              onClick={() => setComando(q)}
              className="text-[10px] px-2.5 py-1 rounded-full border border-blue-200 text-blue-700 bg-white hover:bg-blue-50 transition-colors max-w-[260px] truncate"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-start">
          <Textarea
            placeholder={`Ex: "Fabricantes de ${portariaInfo.desc.toLowerCase()} no interior de SP" ou "Empresas com certificado vencendo que podem trocar de OCP"  (Ctrl+Enter para enviar)`}
            value={comando}
            onChange={(e) => setComando(e.target.value)}
            className="flex-1 min-h-[72px] resize-none bg-white text-sm"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleHunt(); }}
          />
          <Button
            onClick={handleHunt}
            disabled={isHunting || !comando.trim()}
            className="gap-2 bg-blue-900 hover:bg-blue-800 text-white self-stretch min-w-[120px]"
          >
            {isHunting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /><span>Caçando...</span></>
            ) : (
              <><Sparkles className="h-4 w-4" /><span>Caçar Leads</span></>
            )}
          </Button>
        </div>

        {(isHunting || huntLog.length > 0) && (
          <div className="mt-3 space-y-1 border-t border-blue-100 pt-3">
            {huntLog.map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                {log}
              </div>
            ))}
            {isHunting && (
              <div className="flex items-center gap-2 text-xs text-blue-700 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" /> Processando inteligência de mercado...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resultados */}
      {aiLeads.length > 0 && (
        <div className="bento-card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-heading font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Alvos Mapeados
                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">{filteredLeads.length}</Badge>
              </h3>
              <p className="text-xs text-muted-foreground">Ordenados por score · {portariaInfo.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(["todos", "sem_cert", "vencendo", "ativo"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={`text-[11px] px-3 py-1.5 transition-colors ${
                      filterStatus === f ? "bg-blue-900 text-white" : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {f === "todos" ? "Todos" : f === "sem_cert" ? "Sem cert." : f === "vencendo" ? "Vencendo" : "Cliente"}
                  </button>
                ))}
              </div>
              <button onClick={() => setAiLeads([])} className="text-[11px] text-muted-foreground hover:text-destructive">
                limpar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs">Empresa</TableHead>
                  <TableHead className="text-xs">Localização</TableHead>
                  <TableHead className="text-xs">Motivo Estratégico</TableHead>
                  <TableHead className="text-xs">Certificação</TableHead>
                  <TableHead className="text-xs">OCP Atual</TableHead>
                  <TableHead className="text-xs text-center">Score</TableHead>
                  <TableHead className="text-xs">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead, i) => (
                  <TableRow
                    key={lead.id}
                    className={`hover:bg-muted/50 transition-colors ${
                      lead.certStatus === "vencendo" ? "bg-amber-50/40" :
                      lead.certStatus === "ativo"    ? "bg-emerald-50/30" : ""
                    }`}
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{lead.empresa}</p>
                          {lead.cnpj && <p className="text-[10px] text-muted-foreground font-mono">{lead.cnpj}</p>}
                          {lead.cnae && <Badge variant="outline" className="text-[10px] mt-0.5">{lead.cnae}</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(lead.cidade || lead.uf) ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {[lead.cidade, lead.uf].filter(Boolean).join("/")}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-xs text-foreground leading-relaxed">{lead.motivo}</p>
                    </TableCell>
                    <TableCell>
                      <CertBadge status={lead.certStatus} dias={lead.diasVencimento ?? undefined} />
                    </TableCell>
                    <TableCell>
                      {lead.ocp_atual
                        ? <Badge variant="outline" className="text-[10px] text-muted-foreground">{lead.ocp_atual}</Badge>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreDot score={lead.score} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          className="text-xs h-7 gap-1 bg-blue-900 hover:bg-blue-800 text-white"
                          disabled={savingId === lead.id}
                          onClick={() => handleSaveLead(lead)}
                        >
                          {savingId === lead.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><CheckCircle2 className="h-3 w-3" /> CRM</>}
                        </Button>
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="text-[10px] text-primary hover:underline text-center">e-mail</a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredLeads.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum alvo para o filtro selecionado.
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isHunting && aiLeads.length === 0 && (
        <div className="bento-card py-12 text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <FileSearch className="h-8 w-8 text-blue-300" />
          </div>
          <h3 className="text-base font-heading font-semibold mb-1">Motor aguardando seu comando</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Descreva o perfil de empresas para a <strong>{portariaInfo.label}</strong> e o motor mapeará os melhores alvos estratégicos.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <ArrowRight className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-blue-600 font-medium">Use os atalhos acima ou escreva um comando personalizado</span>
          </div>
        </div>
      )}
    </div>
  );
}
