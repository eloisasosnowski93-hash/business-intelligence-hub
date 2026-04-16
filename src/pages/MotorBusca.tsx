import { useState, useMemo } from "react";
import { useLeads, CATEGORIA_LABELS } from "@/hooks/useLeads";
import { useUnit } from "@/contexts/UnitContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Sparkles, TrendingUp, Users, Filter, X, Star, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Lead = {
  id: string; empresa: string; categoria: string; estado_negocio: string | null;
  etapa: string | null; contato_nome: string | null; contato_email: string | null;
  contato_telefone: string | null; responsavel_csv: string | null; responsavel: string | null;
  produtos: string | null; nome_negocio: string | null; valor_unico: number | null;
  valor_recorrente: number | null; origem_lead: string | null; nacionalidade: string | null;
};

function extrairPalavras(texto: string): string[] {
  return texto.toLowerCase()
    .replace(/[^a-záéíóúãõâêîôûçàèìòù\s]/g, " ")
    .split(/\s+/)
    .filter(p => p.length > 3)
    .filter(p => !["ltda","eireli","s.a.","s/a","brasil","para","com","dos","das","des","industria","comercio","servicos"].includes(p));
}

function scoreLead(lead: Lead, query: string, filtros: any): { score: number; motivos: string[] } {
  const motivos: string[] = [];
  let score = 0;
  const q = query.toLowerCase();

  if (q && lead.empresa.toLowerCase().includes(q)) { score += 30; motivos.push("Nome da empresa"); }
  if (q && lead.produtos?.toLowerCase().includes(q)) { score += 25; motivos.push("Produto/serviço"); }
  if (q && lead.nome_negocio?.toLowerCase().includes(q)) { score += 20; motivos.push("Nome do negócio"); }
  if (q && lead.contato_nome?.toLowerCase().includes(q)) { score += 15; motivos.push("Contato"); }

  if (filtros.categoria && lead.categoria === filtros.categoria) { score += 20; motivos.push("Categoria correspondente"); }
  if (filtros.estado && lead.estado_negocio === filtros.estado) { score += 15; }
  if (filtros.responsavel && (lead.responsavel_csv || lead.responsavel) === filtros.responsavel) { score += 10; }

  if (lead.estado_negocio === "Vendida") { score += 15; motivos.push("Lead convertido"); }
  if (lead.contato_email) { score += 10; motivos.push("E-mail disponível"); }
  if (lead.contato_telefone) { score += 10; motivos.push("Telefone disponível"); }
  if ((lead.valor_unico || 0) + (lead.valor_recorrente || 0) > 5000) { score += 10; motivos.push("Alto valor"); }

  return { score, motivos };
}

function SimilaresCard({ lead, todos }: { lead: Lead; todos: Lead[] }) {
  const [aberto, setAberto] = useState(false);
  const palavras = extrairPalavras(lead.empresa + " " + (lead.produtos || ""));
  const similares = todos
    .filter(l => l.id !== lead.id)
    .map(l => {
      const p2 = extrairPalavras(l.empresa + " " + (l.produtos || ""));
      const comum = palavras.filter(p => p2.includes(p)).length;
      return { lead: l, match: comum };
    })
    .filter(x => x.match > 0)
    .sort((a, b) => b.match - a.match)
    .slice(0, 3);

  if (!similares.length) return null;

  return (
    <div className="mt-1">
      <button onClick={() => setAberto(!aberto)}
        className="text-[10px] text-primary flex items-center gap-1 hover:underline">
        {aberto ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {similares.length} empresa(s) similar(es)
      </button>
      {aberto && (
        <div className="mt-1 space-y-1 pl-2 border-l-2 border-primary/20">
          {similares.map(s => (
            <div key={s.lead.id} className="text-[10px] text-muted-foreground">
              {s.lead.empresa}
              <Badge variant="outline" className="text-[9px] ml-1">{s.match} match</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MotorBusca() {
  const { unit } = useUnit();
  const { data: leads, isLoading } = useLeads();
  const [query, setQuery] = useState("");
  const [filtros, setFiltros] = useState({ categoria: "", estado: "", responsavel: "" });
  const [showFiltros, setShowFiltros] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [cnpjEnrich, setCnpjEnrich] = useState<string>("");

  const categorias = useMemo(() => {
    const cats = new Set((leads || []).map(l => l.categoria));
    return Array.from(cats);
  }, [leads]);

  const estados = useMemo(() => {
    const es = new Set((leads || []).map(l => l.estado_negocio).filter(Boolean));
    return Array.from(es) as string[];
  }, [leads]);

  const responsaveis = useMemo(() => {
    const rs = new Set((leads || []).map(l => l.responsavel_csv || l.responsavel).filter(Boolean));
    return Array.from(rs) as string[];
  }, [leads]);

  const resultados = useMemo(() => {
    if (!leads) return [];
    const temQuery = query.length >= 2;
    const temFiltro = filtros.categoria || filtros.estado || filtros.responsavel;
    if (!temQuery && !temFiltro) return [];

    return leads
      .map(l => ({ lead: l, ...scoreLead(l, query, filtros) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }, [leads, query, filtros]);

  const sugestoes = useMemo(() => {
    if (!leads || resultados.length === 0) return [];
    const convertidos = leads.filter(l => l.estado_negocio === "Vendida");
    if (!convertidos.length) return [];

    const palavrasChave = new Set<string>();
    convertidos.forEach(l => {
      extrairPalavras(l.empresa + " " + (l.produtos || "")).forEach(p => palavrasChave.add(p));
    });

    const naoConvertidos = leads.filter(l => l.estado_negocio !== "Vendida");
    return naoConvertidos
      .map(l => {
        const palavras = extrairPalavras(l.empresa + " " + (l.produtos || ""));
        const matches = palavras.filter(p => palavrasChave.has(p)).length;
        return { lead: l, matches };
      })
      .filter(x => x.matches >= 2)
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 5);
  }, [leads, resultados]);

  const handleEnrichCnpj = async () => {
    const clean = cnpjEnrich.replace(/\D/g, "");
    if (clean.length !== 14) { toast.error("CNPJ inválido"); return; }
    setBuscando(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      const existing = leads?.find(l => l.empresa.toLowerCase().includes(data.razao_social.toLowerCase().slice(0, 10)));
      if (existing) {
        await supabase.from("leads").update({
          contato_email: data.email || existing.contato_email,
          contato_telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1}` : existing.contato_telefone,
        }).eq("id", existing.id);
        toast.success(`Dados atualizados para ${existing.empresa}`);
      } else {
        toast.info(`Empresa: ${data.razao_social} — não encontrada na base. Importe via CSV para adicionar.`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBuscando(false); }
  };

  const limparFiltros = () => { setQuery(""); setFiltros({ categoria: "", estado: "", responsavel: "" }); };
  const temFiltrosAtivos = query || filtros.categoria || filtros.estado || filtros.responsavel;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Motor de Busca Inteligente
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Busca semântica na base de {(leads || []).length} leads · Sugestões baseadas em conversões anteriores
        </p>
      </div>

      {/* Sugestões automáticas */}
      {sugestoes.length > 0 && (
        <div className="bento-card border-primary/20 bg-primary/5">
          <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" /> Leads com perfil similar aos convertidos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sugestoes.map(({ lead, matches }) => (
              <div key={lead.id} className="p-3 bg-background rounded-lg border border-border">
                <p className="font-medium text-sm">{lead.empresa}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{lead.etapa || "—"} · {lead.responsavel_csv || lead.responsavel || "—"}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[10px]">{matches} pontos de similaridade</Badge>
                  <Badge variant={lead.estado_negocio === "Em Andamento" ? "default" : "outline"} className="text-[10px]">{lead.estado_negocio || "—"}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Busca principal */}
      <div className="bento-card">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por empresa, produto, contato, negócio..."
              value={query} onChange={e => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFiltros(!showFiltros)} className="gap-2">
            <Filter className="h-4 w-4" /> Filtros
            {(filtros.categoria || filtros.estado || filtros.responsavel) && (
              <Badge className="text-[10px] h-4 w-4 p-0 flex items-center justify-center">!</Badge>
            )}
          </Button>
          {temFiltrosAtivos && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1 text-muted-foreground">
              <X className="h-4 w-4" /> Limpar
            </Button>
          )}
        </div>

        {showFiltros && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categoria / Portaria</label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={filtros.categoria} onChange={e => setFiltros(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">Todas</option>
                {categorias.map(c => <option key={c} value={c}>{CATEGORIA_LABELS[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status do Negócio</label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={filtros.estado} onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}>
                <option value="">Todos</option>
                {estados.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={filtros.responsavel} onChange={e => setFiltros(f => ({ ...f, responsavel: e.target.value }))}>
                <option value="">Todos</option>
                {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Enriquecimento por CNPJ */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" /> Buscar + Enriquecer por CNPJ
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Digite um CNPJ para buscar na Receita Federal e atualizar o lead correspondente na base.
        </p>
        <div className="flex gap-3">
          <Input placeholder="00.000.000/0001-00" value={cnpjEnrich}
            onChange={e => setCnpjEnrich(e.target.value)} className="max-w-xs"
            onKeyDown={e => e.key === "Enter" && handleEnrichCnpj()} />
          <Button onClick={handleEnrichCnpj} disabled={buscando} size="sm" className="gap-2">
            {buscando ? "Buscando..." : "Buscar e Enriquecer"}
          </Button>
        </div>
      </div>

      {/* Resultados */}
      {resultados.length > 0 ? (
        <div className="bento-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-heading font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> {resultados.length} resultado(s) encontrado(s)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Relevância</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map(({ lead, score, motivos }) => (
                  <TableRow key={lead.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(score, 100)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{score}pt</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {motivos.slice(0, 2).map((m, i) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{m}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{lead.empresa}</p>
                      {lead.produtos && <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{lead.produtos}</p>}
                      <SimilaresCard lead={lead} todos={leads || []} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {CATEGORIA_LABELS[lead.categoria]?.split("—")[0]?.trim() || lead.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lead.estado_negocio === "Vendida" ? "default" : lead.estado_negocio === "Perdida" ? "destructive" : "secondary"} className="text-xs">
                        {lead.estado_negocio || "—"}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{lead.etapa || ""}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{lead.contato_nome || <span className="text-red-400">sem contato</span>}</div>
                      {lead.contato_email && <a href={`mailto:${lead.contato_email}`} className="text-[10px] text-primary hover:underline">{lead.contato_email}</a>}
                      {lead.contato_telefone && <div className="text-[10px]">{lead.contato_telefone}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.responsavel_csv || lead.responsavel || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : temFiltrosAtivos ? (
        <div className="bento-card text-center py-12">
          <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Tente termos diferentes ou limpe os filtros</p>
        </div>
      ) : (
        <div className="bento-card text-center py-12">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary opacity-40" />
          <p className="text-sm text-muted-foreground">Digite para buscar na base de leads</p>
          <p className="text-xs text-muted-foreground mt-1">Busca por empresa, produto, contato ou negócio</p>
        </div>
      )}
    </div>
  );
}
