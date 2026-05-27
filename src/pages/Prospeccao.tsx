/**
 * Prospecção OCP — Motor de Inteligência de Mercado v2
 * ─────────────────────────────────────────────────────
 * v2: sem limite de leads · Deep Hunter · Save to List · Drawer · Log 5 etapas
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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  ShieldCheck, ShieldAlert, ShieldX,
  Target, Loader2, Sparkles,
  Building2, MapPin, AlertTriangle, CheckCircle2,
  ArrowRight, FileSearch, BrainCircuit, Zap,
  Bookmark, BookmarkCheck, Download, Trash2,
  Users, Award, ListChecks, X,
  HelpCircle, Mail, Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useMonitoredPortarias } from "@/hooks/useMonitoredPortarias";

// ─── Constants ────────────────────────────────────────────────────────────────

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
  if (dias < 0)    return { label: "Vencido",            color: "bg-red-200 text-red-900",      dot: "bg-red-600" };
  if (dias <= 30)  return { label: `${dias}d — URGENTE`, color: "bg-red-100 text-red-700",      dot: "bg-red-500" };
  if (dias <= 90)  return { label: `${dias}d restantes`, color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500" };
  if (dias <= 180) return { label: `${dias}d restantes`, color: "bg-yellow-50 text-yellow-700", dot: "bg-yellow-400" };
  return             { label: `${dias}d restantes`, color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-400" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Decisor {
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  linkedin?: string;
}

interface DeepHunterData {
  decisores?: Decisor[];
  ocp_concorrente?: string;
  certs_inmetro_estimado?: number;
}

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
  deep?: DeepHunterData;
}

// Tooltip clicável com "?" — explica o significado de cada campo/coluna
function HelpHint({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-muted-foreground hover:text-blue-700 transition-colors align-middle"
          aria-label={`Ajuda: ${title}`}
        >
          <HelpCircle className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-xs leading-relaxed">
        <p className="font-semibold text-sm mb-1 text-foreground">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CertBadge({ status, dias }: { status: AILead["certStatus"]; dias?: number }) {
  if (status === "ativo") return (
    <Badge className="gap-1 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
      <ShieldCheck className="h-3 w-3" /> Cliente Scitec
    </Badge>
  );
  if (status === "vencendo") return (
    <Badge className="gap-1 text-[10px] bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">
      <ShieldAlert className="h-3 w-3" /> Vence em {dias}d
    </Badge>
  );
  if (status === "sem_cert") return (
    <Badge className="gap-1 text-[10px] bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">
      <ShieldX className="h-3 w-3" /> Sem certificação
    </Badge>
  );
  return (
    <Badge className="gap-1 text-[10px] bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50">
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

function DeepPills({ deep }: { deep?: DeepHunterData }) {
  if (!deep) return null;
  const firstDecisor = deep.decisores?.[0];
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {firstDecisor && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
          <Users className="h-2.5 w-2.5" />
          {firstDecisor.nome}
          {firstDecisor.cargo ? ` (${firstDecisor.cargo})` : ""}
          {deep.decisores!.length > 1 ? ` +${deep.decisores!.length - 1}` : ""}
        </span>
      )}
      {deep.ocp_concorrente && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
          <Award className="h-2.5 w-2.5" />
          {deep.ocp_concorrente}
        </span>
      )}
      {deep.certs_inmetro_estimado !== undefined && (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
          <ListChecks className="h-2.5 w-2.5" />
          ~{deep.certs_inmetro_estimado} certs INMETRO
        </span>
      )}
    </div>
  );
}

// Bloco detalhado de decisores (nome, cargo, e-mail, telefone)
function DecisoresList({ decisores }: { decisores?: Decisor[] }) {
  if (!decisores || decisores.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {decisores.slice(0, 3).map((d, i) => (
        <div
          key={i}
          className="text-[10px] bg-purple-50/60 border border-purple-100 rounded px-2 py-1"
        >
          <div className="font-semibold text-purple-900 leading-tight">
            {d.nome}
            {d.cargo && <span className="font-normal text-purple-700"> — {d.cargo}</span>}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            {d.email && (
              <a
                href={`mailto:${d.email}`}
                className="inline-flex items-center gap-1 text-blue-700 hover:underline"
              >
                <Mail className="h-2.5 w-2.5" />{d.email}
              </a>
            )}
            {d.telefone && (
              <a
                href={`tel:${d.telefone.replace(/\D/g, "")}`}
                className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
              >
                <Phone className="h-2.5 w-2.5" />{d.telefone}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Drawer Minha Lista ───────────────────────────────────────────────────────

function ListaContatoDrawer({
  open,
  onClose,
  lista,
  onRemove,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  lista: AILead[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const exportCsv = () => {
    if (!lista.length) return;
    const headers = [
      "empresa","cnpj","cidade","uf","cnae","contato",
      "email","telefone","motivo","score","portaria",
      "certStatus","ocp_atual","decisores","decisores_emails","decisores_telefones",
      "ocp_concorrente","certs_inmetro_estimado",
    ];
    const rows = lista.map((l) => {
      const decisores = l.deep?.decisores || [];
      const decisoresStr = decisores.map(d => `${d.nome}${d.cargo ? ` (${d.cargo})` : ""}`).join("; ");
      const emailsStr = decisores.map(d => d.email).filter(Boolean).join("; ");
      const telsStr = decisores.map(d => d.telefone).filter(Boolean).join("; ");
      return [
        l.empresa, l.cnpj || "", l.cidade || "", l.uf || "", l.cnae || "",
        l.contato || "", l.email || "", l.telefone || "",
        `"${(l.motivo || "").replace(/"/g, '""')}"`,
        l.score, l.portaria, l.certStatus, l.ocp_atual || "",
        `"${decisoresStr}"`, `"${emailsStr}"`, `"${telsStr}"`,
        l.deep?.ocp_concorrente || "",
        l.deep?.certs_inmetro_estimado ?? "",
      ].join(",");
    });
    const blob = new Blob(
      [headers.join(",") + "\n" + rows.join("\n")],
      { type: "text/csv;charset=utf-8;" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista_contato_ocp_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-base font-heading flex items-center gap-2">
                <BookmarkCheck className="h-4 w-4 text-blue-700" />
                Minha Lista de Contato
              </SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                {lista.length} empresa{lista.length !== 1 ? "s" : ""} salva{lista.length !== 1 ? "s" : ""}
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8"
                onClick={exportCsv}
                disabled={!lista.length}
              >
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive"
                onClick={onClear}
                disabled={!lista.length}
              >
                <Trash2 className="h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {lista.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Bookmark className="h-6 w-6 text-blue-300" />
              </div>
              <p className="text-sm font-medium text-foreground">Lista vazia</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique no ícone de bookmark em qualquer lead para salvá-lo aqui.
              </p>
            </div>
          ) : (
            lista.map((lead) => (
              <div
                key={lead.id}
                className="relative p-3.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors group"
              >
                <button
                  onClick={() => onRemove(lead.id)}
                  className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-blue-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">{lead.empresa}</p>
                    {lead.cnpj && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{lead.cnpj}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <CertBadge status={lead.certStatus} dias={lead.diasVencimento} />
                      {lead.ocp_atual && (
                        <Badge variant="outline" className="text-[10px]">{lead.ocp_atual}</Badge>
                      )}
                      <Badge className="text-[10px] bg-blue-50 text-blue-700 border-blue-100">
                        Score {lead.score}/10
                      </Badge>
                    </div>
                    {lead.deep && <DeepPills deep={lead.deep} />}
                    {lead.deep?.decisores && <DecisoresList decisores={lead.deep.decisores} />}
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug line-clamp-2">
                      {lead.motivo}
                    </p>
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-[10px] text-primary hover:underline mt-1 block"
                      >
                        ✉ {lead.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
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
  const [listaContato, setListaContato] = useState<AILead[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { portarias: monitored } = useMonitoredPortarias();
  const queryClient = useQueryClient();
  const portariaInfo = PORTARIAS_OCP.find((p) => p.value === selectedPortaria)!;

  // ── Alvos de renovação ────────────────────────────────────────────────────
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

  // ── Lista helpers ─────────────────────────────────────────────────────────
  const isInLista = (id: string) => listaContato.some((l) => l.id === id);

  const toggleLista = (lead: AILead) => {
    if (isInLista(lead.id)) {
      setListaContato((prev) => prev.filter((l) => l.id !== lead.id));
      toast.info(`${lead.empresa} removido da lista`);
    } else {
      setListaContato((prev) => [...prev, lead]);
      toast.success(`${lead.empresa} adicionado à lista!`);
    }
  };

  // ── Motor IA ──────────────────────────────────────────────────────────────
  const addLog = (msg: string) => setHuntLog((prev) => [...prev.slice(-5), msg]);

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

      const systemPrompt = `Você é o Hunter OCP da Scitec Certificações — especialista em prospecção estratégica de empresas para certificação de produto OCP junto ao INMETRO.

PORTARIA ATIVA: ${portariaInfo.label} — ${portariaInfo.desc}
CNAEs principais: ${portariaInfo.cnaes.join(", ") || "variados"}
Responsável Scitec: ${portariaInfo.resp}

CERTIFICADOS CRÍTICOS NA BASE (≤ 90 dias):
${certContext || "Nenhum certificado crítico na base."}

REGRAS:
1. ESCOPO GEOGRÁFICO: TODO O BRASIL. Cubra TODAS as regiões (Norte, Nordeste, Centro-Oeste, Sudeste, Sul) — NÃO se limite a São Paulo nem a uma única região, exceto se o usuário pedir explicitamente.
2. VOLUME: retorne NO MÍNIMO 20 empresas (idealmente 30-50). Não corte a lista — inclua todas as empresas relevantes que conseguir mapear. NÃO há limite artificial.
3. Priorize empresas com certificado vencendo ou sem certificação OCP ativa.
4. Identifique se a empresa pode estar com OUTRA OCP concorrente (Bureau Veritas, IMETRO, Inova, etc.).
5. Score 0-10: CNAE correto +4, empresa ativa +2, contato disponível +2, cert vencendo +2.
6. motivo: UMA frase estratégica sobre por que abordar AGORA.
7. Para cada lead, preencher o campo "deep":
   - decisores: array de até 3 OBJETOS de decisores reais (Diretor Compras, Gerente Qualidade, CEO, Diretor Industrial). Cada objeto DEVE conter: { "nome": "Nome Completo", "cargo": "Cargo", "email": "email corporativo (ex: nome@empresa.com.br) ou null se não souber", "telefone": "telefone com DDD ou null" }. SEMPRE busque inferir e-mails corporativos plausíveis no domínio da empresa quando não tiver fonte direta; marque telefone como null se não houver dado público.
   - ocp_concorrente: nome da OCP atual se houver (ou null)
   - certs_inmetro_estimado: número estimado de certificados ativos no INMETRO
8. Distribua geograficamente: tente incluir empresas de múltiplos estados (SP, RJ, MG, RS, PR, SC, BA, PE, GO, CE, AM, etc.).
9. Além dos decisores, preencha contato/email/telefone do contato comercial principal da empresa quando possível.

RESPONDA APENAS JSON VÁLIDO, sem markdown, sem texto fora do JSON:
{"analise":"string (resuma cobertura geográfica e total)","total_encontrado":number,"leads":[{"id":"uuid","empresa":"string","cnpj":"string|null","cidade":"string","uf":"string","cnae":"string","contato":"string|null","email":"string|null","telefone":"string|null","motivo":"string","score":number,"portaria":"${portariaInfo.value}","certStatus":"sem_cert|vencendo|ativo|desconhecido","diasVencimento":number|null,"ocp_atual":"string|null","deep":{"decisores":[{"nome":"string","cargo":"string","email":"string|null","telefone":"string|null"}],"ocp_concorrente":"string|null","certs_inmetro_estimado":number}}]}`;

      addLog("[Hunter] Mapeando decisores e certificados...");

      const { data, error: fnError } = await supabase.functions.invoke("hunt-leads-ocp", {
        body: { systemPrompt, comando },
      });

      if (fnError) throw new Error(fnError.message || "Falha na comunicação com o motor");
      if (data?.fallback) {
        toast.warning(data?.error || "Motor temporariamente indisponível — tente novamente em instantes");
        addLog("⚠️ " + (data?.error || "Motor indisponível"));
        return;
      }
      if (data?.error) throw new Error(data.error);
      addLog("📊 Processando e enriquecendo alvos...");

      const rawText = data?.text || "{}";

      let parsed: { analise?: string; total_encontrado?: number; leads?: AILead[] };
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

      addLog(`✅ ${leads.length} alvos mapeados com enriquecimento Deep Hunter`);
      if (parsed.analise) toast.success(parsed.analise, { duration: 8000 });
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

  const quickCommands = [
    `Empresas de ${portariaInfo.desc.toLowerCase()} em todo o Brasil com cert. vencendo`,
    `Fabricantes sem certificação OCP — cobertura nacional (todas as regiões)`,
    `Empresas com OCP concorrente que posso abordar no Brasil inteiro`,
    `Maiores fabricantes do setor (BR) para ${portariaInfo.label}`,
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
        <div className="flex gap-2 flex-wrap items-center">
          <Badge className="text-xs px-3 py-1 bg-blue-900 text-white border-0">
            <ShieldCheck className="h-3 w-3 mr-1" /> SCITEC OCP
          </Badge>
          {critCount > 0 && (
            <Badge className="text-xs px-3 py-1 bg-red-100 text-red-700 border-red-200">
              <AlertTriangle className="h-3 w-3 mr-1" /> {critCount} críticos
            </Badge>
          )}
          {/* Botão Minha Lista */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition-all"
          >
            <BookmarkCheck className="h-3.5 w-3.5" />
            Minha Lista
            {listaContato.length > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">
                {listaContato.length}
              </span>
            )}
          </button>
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
                    c.dias < 0   ? "bg-red-100 border border-red-200" :
                    c.dias <= 90 ? "bg-amber-50 border border-amber-100" :
                                   "bg-muted/40 border border-transparent"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground w-4 shrink-0 font-mono">#{i + 1}</span>
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
              Motor de Inteligência OCP + Deep Hunter
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descreva o perfil de empresa, setor ou estratégia. O motor mapeia alvos, decisores, OCP concorrente e certificados INMETRO.
            </p>
          </div>
        </div>

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
            placeholder={`Ex: "Fabricantes de ${portariaInfo.desc.toLowerCase()} em todo o Brasil" ou "Empresas com certificado vencendo que podem trocar de OCP — cobertura nacional" (Ctrl+Enter)`}
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

        {/* Log animado 5 etapas */}
        {(isHunting || huntLog.length > 0) && (
          <div className="mt-3 space-y-1 border-t border-blue-100 pt-3">
            {huntLog.map((log, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
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
                <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                  <Users className="h-2.5 w-2.5 mr-1" /> Deep Hunter
                </Badge>
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
              <button
                onClick={() => setAiLeads([])}
                className="text-[11px] text-muted-foreground hover:text-destructive"
              >
                limpar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8">#</TableHead>
                  <TableHead className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      Empresa + Deep Data
                      <HelpHint title="Empresa + Deep Data">
                        Nome da empresa, CNPJ, CNAE e dados de inteligência: <b>decisores</b> (nome, cargo, e-mail e telefone), <b>OCP concorrente</b> e <b>nº estimado de certificados INMETRO</b>.
                      </HelpHint>
                    </span>
                  </TableHead>
                  <TableHead className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      Localização
                      <HelpHint title="Localização">
                        Cidade e UF (Unidade Federativa) onde a empresa está sediada. Usado para distribuir prospecção por região.
                      </HelpHint>
                    </span>
                  </TableHead>
                  <TableHead className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      Motivo Estratégico
                      <HelpHint title="Motivo Estratégico">
                        Por que esta empresa deve ser abordada AGORA: certificado vencendo, ausência de OCP, oportunidade de migração de concorrente, etc.
                      </HelpHint>
                    </span>
                  </TableHead>
                  <TableHead className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      Certificação
                      <HelpHint title="Status de Certificação INMETRO">
                        <b>Cliente Scitec</b>: já certificado por nós.<br />
                        <b>Vence em Xd</b>: certificado próximo do vencimento.<br />
                        <b>Sem certificação</b>: empresa-alvo sem certificação OCP ativa.<br />
                        <b>A verificar</b>: status desconhecido — requer pesquisa.
                      </HelpHint>
                    </span>
                  </TableHead>
                  <TableHead className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      OCP Atual
                      <HelpHint title="OCP Atual (concorrente)">
                        Organismo de Certificação de Produto que atende a empresa hoje (Bureau Veritas, IMETRO, Inova, etc.). Útil para estratégia de migração.
                      </HelpHint>
                    </span>
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    <span className="inline-flex items-center gap-1">
                      Score
                      <HelpHint title="Score de Prospecção (0–10)">
                        Pontuação automática: CNAE correto +4 · empresa ativa +2 · contato disponível +2 · cert vencendo +2.<br />
                        <b>🔥 7+</b> quente · <b>⏳ 4–6</b> morno · <b>➕ 0–3</b> frio.
                      </HelpHint>
                    </span>
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    <span className="inline-flex items-center gap-1">
                      Ações
                      <HelpHint title="Ações">
                        <b>CRM</b>: envia o lead direto para o pipeline OCP.<br />
                        <b>Salvar</b>: adiciona à sua Lista de Contato (drawer) para exportar em CSV depois.
                      </HelpHint>
                    </span>
                  </TableHead>
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
                          {lead.cnpj && (
                            <p className="text-[10px] text-muted-foreground font-mono">{lead.cnpj}</p>
                          )}
                          {lead.cnae && (
                            <Badge variant="outline" className="text-[10px] mt-0.5">{lead.cnae}</Badge>
                          )}
                          <DeepPills deep={lead.deep} />
                          <DecisoresList decisores={lead.deep?.decisores} />
                          {(lead.contato || lead.email || lead.telefone) && (
                            <div className="mt-1.5 text-[10px] space-y-0.5">
                              {lead.contato && <div className="text-muted-foreground">Contato: <span className="text-foreground">{lead.contato}</span></div>}
                              {lead.email && (
                                <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-blue-700 hover:underline mr-2">
                                  <Mail className="h-2.5 w-2.5" />{lead.email}
                                </a>
                              )}
                              {lead.telefone && (
                                <a href={`tel:${lead.telefone.replace(/\D/g,"")}`} className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
                                  <Phone className="h-2.5 w-2.5" />{lead.telefone}
                                </a>
                              )}
                            </div>
                          )}
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
                      <div className="flex flex-col gap-1 items-stretch min-w-[80px]">
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
                        {/* Save to List */}
                        <button
                          onClick={() => toggleLista(lead)}
                          title={isInLista(lead.id) ? "Remover da lista" : "Salvar na lista"}
                          className={`flex items-center justify-center gap-1 text-[10px] py-1 rounded border transition-all ${
                            isInLista(lead.id)
                              ? "bg-blue-900 text-white border-blue-900"
                              : "bg-card text-blue-700 border-blue-200 hover:bg-blue-50"
                          }`}
                        >
                          {isInLista(lead.id)
                            ? <><BookmarkCheck className="h-3 w-3" /> Salvo</>
                            : <><Bookmark className="h-3 w-3" /> Salvar</>}
                        </button>
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="text-[10px] text-primary hover:underline text-center"
                          >
                            e-mail
                          </a>
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
            Descreva o perfil de empresas para a <strong>{portariaInfo.label}</strong> e o motor mapeará todos os alvos com Deep Hunter ativo.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <ArrowRight className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-blue-600 font-medium">Use os atalhos acima ou escreva um comando personalizado</span>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3 text-purple-500" /> Decisores mapeados
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Award className="h-3 w-3 text-red-500" /> OCP concorrente
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ListChecks className="h-3 w-3 text-blue-500" /> Certs. INMETRO
            </span>
          </div>
        </div>
      )}

      {/* Drawer Minha Lista de Contato */}
      <ListaContatoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lista={listaContato}
        onRemove={(id) => setListaContato((prev) => prev.filter((l) => l.id !== id))}
        onClear={() => {
          setListaContato([]);
          toast.info("Lista limpa.");
        }}
      />
    </div>
  );
}
