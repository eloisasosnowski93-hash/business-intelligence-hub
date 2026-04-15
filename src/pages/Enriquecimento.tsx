import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeads } from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function Enriquecimento() {
  const { data: leads, isLoading, refetch } = useLeads();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ ok: number; fail: number } | null>(null);
  const [enriched, setEnriched] = useState<Set<string>>(new Set());

  const leadsWithCnpj = (leads || []).filter(l => l.contato_email || l.empresa);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === leadsWithCnpj.length) setSelected(new Set());
    else setSelected(new Set(leadsWithCnpj.map(l => l.id)));
  };

  const handleEnrich = async () => {
    const toEnrich = leadsWithCnpj.filter(l => selected.has(l.id));
    if (!toEnrich.length) { toast.error("Selecione ao menos um lead"); return; }
    setEnriching(true);
    setProgress(0);
    setResults(null);
    let ok = 0, fail = 0;

    for (let i = 0; i < toEnrich.length; i++) {
      const lead = toEnrich[i];
      // Tenta extrair CNPJ do nome da empresa ou email (se disponível)
      // Enriquecimento real requer CNPJ — marca como "buscado" e tenta
      try {
        // Busca pelo nome da empresa na base interna para encontrar possível CNPJ
        // Se o lead tiver CNPJ no campo empresa (14 dígitos), usa diretamente
        const cnpjMatch = lead.empresa?.replace(/\D/g, "");
        if (cnpjMatch && cnpjMatch.length === 14) {
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjMatch}`);
          if (res.ok) {
            const data = await res.json();
            await supabase.from("leads").update({
              contato_nome: data.qsa?.[0]?.nome_socio || lead.contato_nome,
              contato_email: data.email || lead.contato_email,
              contato_telefone: data.telefone_1 || lead.contato_telefone,
            }).eq("id", lead.id);
            setEnriched(prev => new Set([...prev, lead.id]));
            ok++;
          } else { fail++; }
        } else {
          // Sem CNPJ disponível no campo empresa
          fail++;
        }
      } catch { fail++; }
      setProgress(Math.round(((i + 1) / toEnrich.length) * 100));
    }

    setEnriching(false);
    setResults({ ok, fail });
    setSelected(new Set());
    refetch();
    toast.success(`Enriquecimento concluído: ${ok} atualizados, ${fail} falhas`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Enriquecimento de Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">Atualiza dados cadastrais via BrasilAPI (CNPJ)</p>
      </div>

      <div className="bento-card bg-amber-50 border-amber-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <strong>Como funciona:</strong> O enriquecimento busca dados na Receita Federal via BrasilAPI.
            Para funcionar, o campo <strong>"Empresa"</strong> do lead deve conter o <strong>CNPJ (14 dígitos)</strong>.
            Leads com apenas nome da empresa serão marcados como falha — importe o CSV com a coluna CNPJ para melhores resultados.
          </div>
        </div>
      </div>

      {results && (
        <div className="bento-card">
          <h3 className="text-sm font-semibold mb-3">Resultado do Enriquecimento</h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-bold text-lg">{results.ok}</span>
              <span className="text-sm">atualizados</span>
            </div>
            <div className="flex items-center gap-2 text-red-500">
              <XCircle className="h-5 w-5" />
              <span className="font-bold text-lg">{results.fail}</span>
              <span className="text-sm">falhas (sem CNPJ)</span>
            </div>
          </div>
        </div>
      )}

      <div className="bento-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-heading font-semibold">Leads disponíveis ({leadsWithCnpj.length})</h3>
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
                    <Checkbox checked={selected.size === leadsWithCnpj.length && leadsWithCnpj.length > 0}
                      onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsWithCnpj.slice(0, 100).map((l) => (
                  <TableRow key={l.id} className={enriched.has(l.id) ? "bg-green-50" : ""}>
                    <TableCell>
                      <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{l.empresa}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.contato_nome || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.contato_email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.contato_telefone || "—"}</TableCell>
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
