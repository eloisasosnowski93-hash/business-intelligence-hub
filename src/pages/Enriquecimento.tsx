import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeads } from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, Loader2, CheckCircle, XCircle, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";

async function enrichByCnpj(cnpj: string) {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      contato_nome: d.qsa?.[0]?.nome_socio || null,
      contato_email: d.email || null,
      contato_telefone: d.ddd_telefone_1 ? `(${d.ddd_telefone_1}) ${d.telefone_1}` : d.telefone_1 || null,
      produtos: d.cnae_fiscal_descricao || null,
    };
  } catch { return null; }
}

async function enrichByName(nome: string) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/search?query=${encodeURIComponent(nome)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.cnpj) return null;
    return enrichByCnpj(data.cnpj);
  } catch { return null; }
}

export default function Enriquecimento() {
  const { data: leads, isLoading, refetch } = useLeads();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ ok: number; fail: number } | null>(null);
  const [enriched, setEnriched] = useState<Set<string>>(new Set());

  const filtered = (leads || []).filter(l =>
    !search || l.empresa.toLowerCase().includes(search.toLowerCase()) ||
    (l.contato_nome || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)));
  };

  const handleEnrich = async () => {
    const toEnrich = filtered.filter(l => selected.has(l.id));
    if (!toEnrich.length) { toast.error("Selecione ao menos um lead"); return; }
    setEnriching(true); setProgress(0); setResults(null);
    let ok = 0, fail = 0;

    for (let i = 0; i < toEnrich.length; i++) {
      const lead = toEnrich[i];
      let enriched_data = null;

      const cnpjMatch = lead.empresa?.replace(/\D/g, "");
      if (cnpjMatch && cnpjMatch.length === 14) {
        enriched_data = await enrichByCnpj(cnpjMatch);
      }

      if (!enriched_data && lead.empresa && lead.empresa.length > 3) {
        enriched_data = await enrichByName(lead.empresa);
      }

      if (enriched_data) {
        const update: any = {};
        if (enriched_data.contato_nome && !lead.contato_nome) update.contato_nome = enriched_data.contato_nome;
        if (enriched_data.contato_email && !lead.contato_email) update.contato_email = enriched_data.contato_email;
        if (enriched_data.contato_telefone && !lead.contato_telefone) update.contato_telefone = enriched_data.contato_telefone;
        if (Object.keys(update).length > 0) {
          await supabase.from("leads").update(update).eq("id", lead.id);
          setEnriched(prev => new Set([...prev, lead.id]));
          ok++;
        } else { fail++; }
      } else { fail++; }

      setProgress(Math.round(((i + 1) / toEnrich.length) * 100));
      await new Promise(r => setTimeout(r, 300));
    }

    setEnriching(false); setResults({ ok, fail }); setSelected(new Set());
    refetch();
    toast.success(`Concluído: ${ok} atualizados, ${fail} sem dados disponíveis`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Enriquecimento de Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">Atualiza dados via BrasilAPI por CNPJ ou nome da empresa</p>
      </div>

      <div className="bento-card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            <strong>Como funciona:</strong> Para leads com CNPJ no campo empresa, busca diretamente na Receita Federal.
            Para demais leads, tenta localizar pelo nome da empresa. Campos já preenchidos não são sobrescritos.
          </div>
        </div>
      </div>

      {results && (
        <div className="bento-card">
          <h3 className="text-sm font-semibold mb-3">Resultado</h3>
          <div className="flex gap-6">
            <div className="flex items-center gap-2 text-green-600"><CheckCircle className="h-5 w-5" /><span className="font-bold text-lg">{results.ok}</span><span className="text-sm">atualizados</span></div>
            <div className="flex items-center gap-2 text-red-500"><XCircle className="h-5 w-5" /><span className="font-bold text-lg">{results.fail}</span><span className="text-sm">sem dados disponíveis</span></div>
          </div>
        </div>
      )}

      <div className="bento-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
            </div>
            {selected.size > 0 && <Badge variant="secondary">{selected.size} selecionados</Badge>}
          </div>
          <Button onClick={handleEnrich} disabled={enriching || selected.size === 0} className="gap-2">
            {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {enriching ? `Enriquecendo... ${progress}%` : "Enriquecer Selecionados"}
          </Button>
        </div>

        {enriching && <Progress value={progress} className="mb-4 h-2" />}

        {isLoading ? (
          <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map(l => (
                  <TableRow key={l.id} className={enriched.has(l.id) ? "bg-green-50" : ""}>
                    <TableCell><Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} /></TableCell>
                    <TableCell className="font-medium text-sm">{l.empresa}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.contato_nome || <span className="text-red-400 text-xs">vazio</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.contato_email || <span className="text-red-400 text-xs">vazio</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.contato_telefone || <span className="text-red-400 text-xs">vazio</span>}</TableCell>
                    <TableCell>
                      {enriched.has(l.id)
                        ? <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Enriquecido</Badge>
                        : <Badge variant="outline" className="text-xs">Pendente</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
