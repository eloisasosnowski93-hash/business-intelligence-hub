import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Plus, Bell, AlertTriangle, CheckCircle, Loader2, RefreshCw, ExternalLink, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Certificado {
  id: string;
  numero_certificado: string;
  cnpj_empresa: string | null;
  razao_social: string | null;
  data_validade: string;
  status_registro: string | null;
  portaria: string | null;
  titular: string | null;
  numero_acreditacao: string | null;
}

const PORTARIAS = [
  { value: "145/2022", label: "Portaria 145/2022 — Componentes Automotivos" },
  { value: "384/2020", label: "Portaria 384/2020 — Equip. Vigilância Sanitária" },
  { value: "501/2021", label: "Portaria 501/2021 — Rodas" },
  { value: "071/2022", label: "Portaria 071/2022" },
  { value: "outro", label: "Outro" },
];

function diasParaVencer(validade: string): number {
  return Math.ceil((new Date(validade + "T00:00:00").getTime() - new Date().setHours(0,0,0,0)) / 86400000);
}

function StatusBadge({ dias }: { dias: number }) {
  if (dias < 0) return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Vencido há {Math.abs(dias)}d</Badge>;
  if (dias <= 90) return <Badge className="text-xs gap-1 bg-red-100 text-red-700 border-red-200 hover:bg-red-100"><Bell className="h-3 w-3" />Crítico — {dias}d</Badge>;
  if (dias <= 180) return <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"><AlertTriangle className="h-3 w-3" />Atenção — {dias}d</Badge>;
  return <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100"><CheckCircle className="h-3 w-3" />Ativo — {dias}d</Badge>;
}

export default function Certificacao() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get("filter") === "criticos" ? "criticos" : "todas";
  const [form, setForm] = useState({
    numero_certificado: "", cnpj_empresa: "", razao_social: "",
    portaria: "145/2022", data_validade: "", numero_acreditacao: "",
  });
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filterPortaria, setFilterPortaria] = useState<string>(initialFilter);
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);

  const { data: certs, isLoading } = useQuery<Certificado[]>({
    queryKey: ["certificados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificados").select("*").order("data_validade");
      if (error) {
        console.error("[certificados] fetch error", error);
        toast.error("Falha ao carregar certificados — exibindo lista vazia");
        return [];
      }
      return (data || []) as Certificado[];
    },
    retry: 1,
  });

  // Auto-sync na primeira carga: dispara varredura SCITEC se a tabela estiver vazia
  useEffect(() => {
    (async () => {
      try {
        const { count } = await supabase.from("certificados").select("*", { count: "exact", head: true });
        if ((count ?? 0) === 0) {
          const { data } = await supabase.functions.invoke("sync-inmetro", { body: {} });
          if (data?.success) {
            toast.success(data.message);
            qc.invalidateQueries({ queryKey: ["certificados"] });
            qc.invalidateQueries({ queryKey: ["cert-alerts-90d"] });
          }
        }
      } catch (e) { console.warn("auto-sync skipped", e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async () => {
    if (!form.numero_certificado || !form.data_validade) {
      toast.error("Preencha número do certificado e validade");
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from("certificados").insert({
        numero_certificado: form.numero_certificado,
        cnpj_empresa: form.cnpj_empresa || null,
        razao_social: form.razao_social || null,
        portaria: form.portaria,
        data_validade: form.data_validade,
        numero_acreditacao: form.numero_acreditacao || null,
      });
      if (error) throw error;
      toast.success("Certificado cadastrado!");
      setForm({ numero_certificado: "", cnpj_empresa: "", razao_social: "", portaria: "145/2022", data_validade: "", numero_acreditacao: "" });
      qc.invalidateQueries({ queryKey: ["certificados"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao cadastrar (RLS pode bloquear inserts públicos)");
    } finally { setAdding(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-inmetro", { body: {} });
      if (error) throw error;
      if (data?.fallback) {
        toast.warning(data.message || "Varredura indisponível — mantendo dados atuais");
      } else {
        toast.success(data?.message || "Sincronização concluída");
      }
      qc.invalidateQueries({ queryKey: ["certificados"] });
      qc.invalidateQueries({ queryKey: ["cert-alerts-90d"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar — dados atuais preservados");
    } finally { setSyncing(false); }
  };

  // Parse colado do INMETRO Prodcert: cada linha = 1 certificado
  // Heurística: detecta CNPJ (14 dígitos), data dd/mm/yyyy, número de certificado, razão social
  const parsePastedRows = (text: string) => {
    const rows: any[] = [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const cnpjRe = /\b(\d{2}[.\-/]?\d{3}[.\-/]?\d{3}[.\-/]?\d{4}[.\-/]?\d{2})\b/;
    const dateRe = /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/;
    const certRe = /\b([A-Z0-9]{2,}[-\/.][A-Z0-9\-\/.]{3,})\b/;

    for (const line of lines) {
      // Linha pode usar TAB, ; ou múltiplos espaços como separador
      const parts = line.split(/\t|;|\s{2,}/).map(p => p.trim()).filter(Boolean);
      const joined = line;

      const cnpjMatch = joined.match(cnpjRe);
      const dateMatch = joined.match(dateRe);
      if (!dateMatch) continue; // sem validade, pula

      const cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, "") : null;
      const dataValidade = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

      // numero_certificado: primeiro token que parece código (com letras+números/traço)
      let numero = parts.find(p => certRe.test(p) && !cnpjRe.test(p) && !dateRe.test(p));
      if (!numero) {
        // fallback: primeiro token alfanumérico não-data, não-cnpj
        numero = parts.find(p => /[A-Z0-9]/i.test(p) && !cnpjRe.test(p) && !dateRe.test(p)) || `IMPORT-${Date.now()}-${rows.length}`;
      }

      // razão social: maior token alfabético restante
      const razao = parts
        .filter(p => p !== numero && !cnpjRe.test(p) && !dateRe.test(p))
        .sort((a, b) => b.length - a.length)[0] || null;

      rows.push({
        numero_certificado: numero,
        cnpj_empresa: cnpj,
        razao_social: razao,
        data_validade: dataValidade,
        portaria: form.portaria,
        status_registro: "ativo",
      });
    }
    return rows;
  };

  const handleImportPaste = async () => {
    if (!pasteText.trim()) { toast.error("Cole os dados do INMETRO primeiro"); return; }
    setImporting(true);
    try {
      const rows = parsePastedRows(pasteText);
      if (!rows.length) {
        toast.error("Nenhuma linha válida detectada (verifique se há datas dd/mm/yyyy)");
        return;
      }
      const { error } = await supabase.from("certificados").upsert(rows, { onConflict: "numero_certificado" });
      if (error) throw error;
      toast.success(`${rows.length} certificado(s) importado(s)!`);
      setPasteText("");
      qc.invalidateQueries({ queryKey: ["certificados"] });
      qc.invalidateQueries({ queryKey: ["cert-alerts-90d"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
    } finally { setImporting(false); }
  };

  const all = certs || [];
  const vencidos = all.filter(c => diasParaVencer(c.data_validade) < 0);
  const criticos90 = all.filter(c => { const d = diasParaVencer(c.data_validade); return d >= 0 && d <= 90; });
  const proximosVencimento = vencidos.length + criticos90.length;
  const atencao180 = all.filter(c => { const d = diasParaVencer(c.data_validade); return d > 90 && d <= 180; });
  const ativos = all.filter(c => diasParaVencer(c.data_validade) > 180);

  const filtered = useMemo(() => {
    if (filterPortaria === "todas") return all;
    if (filterPortaria === "criticos") return [...vencidos, ...criticos90];
    return all.filter(c => c.portaria === filterPortaria);
  }, [all, filterPortaria, vencidos, criticos90]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Certificação OCP</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de certificados OCP da Scitec — vencimentos e alertas (90 dias)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => window.open("http://www.inmetro.gov.br/prodcert/", "_blank")}>
            <ExternalLink className="h-4 w-4" /> INMETRO Prodcert
          </Button>
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar INMETRO
          </Button>
        </div>
      </div>

      {/* Top alert counter */}
      <button onClick={() => setFilterPortaria("criticos")}
        className={`w-full text-left bento-card transition-all ${proximosVencimento > 0 ? "border-red-300 bg-red-50 hover:bg-red-100" : "hover:bg-accent"}`}>
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${proximosVencimento > 0 ? "bg-red-200" : "bg-green-100"}`}>
            <Bell className={`h-6 w-6 ${proximosVencimento > 0 ? "text-red-700" : "text-green-700"}`} />
          </div>
          <div>
            <p className="text-2xl font-bold">{proximosVencimento} Certificados próximos ao vencimento</p>
            <p className="text-xs text-muted-foreground">Vencidos ou com 90 dias ou menos restantes — clique para filtrar</p>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card text-center"><p className="text-3xl font-bold">{all.length}</p><p className="text-xs text-muted-foreground mt-1">Total</p></div>
        <div className="bento-card text-center"><p className="text-3xl font-bold text-green-600">{ativos.length}</p><p className="text-xs text-muted-foreground mt-1">Ativos (+180d)</p></div>
        <div className="bento-card text-center"><p className="text-3xl font-bold text-amber-600">{atencao180.length}</p><p className="text-xs text-muted-foreground mt-1">Atenção (90–180d)</p></div>
        <div className="bento-card text-center"><p className="text-3xl font-bold text-red-600">{proximosVencimento}</p><p className="text-xs text-muted-foreground mt-1">Críticos/Vencidos</p></div>
      </div>

      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2"><Plus className="h-4 w-4" />Cadastrar Certificado</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="Nº Certificado" value={form.numero_certificado} onChange={e => setForm(f => ({ ...f, numero_certificado: e.target.value }))} />
          <Input placeholder="CNPJ da Empresa" value={form.cnpj_empresa} onChange={e => setForm(f => ({ ...f, cnpj_empresa: e.target.value }))} />
          <Input placeholder="Razão Social" value={form.razao_social} onChange={e => setForm(f => ({ ...f, razao_social: e.target.value }))} />
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.portaria} onChange={e => setForm(f => ({ ...f, portaria: e.target.value }))}>
            {PORTARIAS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <Input type="date" value={form.data_validade} onChange={e => setForm(f => ({ ...f, data_validade: e.target.value }))} />
          <Input placeholder="Nº Acreditação OCP" value={form.numero_acreditacao} onChange={e => setForm(f => ({ ...f, numero_acreditacao: e.target.value }))} />
        </div>
        <Button onClick={handleAdd} disabled={adding} className="mt-3 gap-2">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Cadastrar
        </Button>
      </div>

      {/* Importador por colagem (INMETRO Prodcert) */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-2 flex items-center gap-2">
          <ClipboardPaste className="h-4 w-4" />Importar por colagem (INMETRO Prodcert)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Cole as linhas copiadas da tabela do <a href="http://www.inmetro.gov.br/prodcert/" target="_blank" rel="noopener" className="text-primary underline">Prodcert</a>.
          O sistema detecta automaticamente CNPJ, número do certificado, razão social e data de validade (dd/mm/aaaa).
          Linhas sem data de validade são ignoradas. Certificados com mesmo número são atualizados.
          Portaria atual: <strong>{form.portaria}</strong>.
        </p>
        <Textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder={"Ex: SCITEC-145-001\t12.345.678/0001-99\tEmpresa XYZ Ltda\t31/12/2025\nSCITEC-145-002\t98.765.432/0001-11\tOutra Empresa SA\t15/06/2026"}
          className="min-h-[140px] font-mono text-xs"
        />
        <Button onClick={handleImportPaste} disabled={importing} className="mt-3 gap-2">
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
          Importar dados colados
        </Button>
      </div>

      <div className="bento-card">
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant={filterPortaria === "todas" ? "default" : "outline"} onClick={() => setFilterPortaria("todas")} className="text-xs">Todas ({all.length})</Button>
          <Button size="sm" variant={filterPortaria === "criticos" ? "default" : "outline"} onClick={() => setFilterPortaria("criticos")} className="text-xs">Críticos/Vencidos ({proximosVencimento})</Button>
          {PORTARIAS.map(p => {
            const count = all.filter(c => c.portaria === p.value).length;
            if (count === 0) return null;
            return (
              <Button key={p.value} size="sm" variant={filterPortaria === p.value ? "default" : "outline"}
                onClick={() => setFilterPortaria(p.value)} className="text-xs">{p.value} ({count})</Button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-12">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhum certificado encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Cadastre manualmente ou clique em "Sincronizar INMETRO"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Certificado</TableHead><TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead><TableHead>Portaria</TableHead>
                <TableHead>Validade</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const dias = diasParaVencer(c.data_validade);
                  const alerta90 = dias <= 90;
                  return (
                    <TableRow key={c.id} className={dias < 0 ? "bg-red-100" : alerta90 ? "bg-red-50" : dias <= 180 ? "bg-amber-50/50" : ""}>
                      <TableCell>{alerta90 && <Bell className="h-4 w-4 text-red-600 animate-pulse" />}</TableCell>
                      <TableCell className="font-medium text-sm">{c.numero_certificado}</TableCell>
                      <TableCell className="text-sm">{c.razao_social || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.cnpj_empresa || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{c.portaria || "—"}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(c.data_validade + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell><StatusBadge dias={dias} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
