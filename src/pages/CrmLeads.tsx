import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeads } from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, FileText, Search, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).map(line => {
    const vals = line.split(/[,;]/);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || "").trim()]));
  });
}

function mapRow(row: Record<string, string>) {
  const get = (...keys: string[]) => keys.map(k => row[k]).find(v => v) || null;
  return {
    empresa: get("empresa", "razao_social", "company", "nome_empresa") || "—",
    nome_negocio: get("nome_negocio", "negocio", "deal", "oportunidade"),
    contato_nome: get("contato_nome", "contato", "nome", "contact"),
    contato_email: get("contato_email", "email", "e_mail"),
    contato_telefone: get("contato_telefone", "telefone", "phone", "celular"),
    etapa: get("etapa", "stage", "fase"),
    estado_negocio: get("estado_negocio", "status", "estado"),
    responsavel: get("responsavel", "responsavel_csv", "owner", "vendedor"),
    produtos: get("produtos", "produto", "servico", "product"),
    categoria: get("categoria", "portaria", "funil") || "portaria_145_2022",
    origem_lead: "csv_import",
  };
}

export default function CrmLeads() {
  const { data: leads, isLoading, refetch } = useLeads();
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = (leads || []).filter(l =>
    !search || l.empresa.toLowerCase().includes(search.toLowerCase()) ||
    (l.contato_nome || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.contato_email || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (!rows.length) { toast.error("CSV vazio ou formato inválido"); return; }
      setPreview(rows.slice(0, 5));
      toast.info(`${rows.length} linhas detectadas. Clique em "Confirmar Importação" para salvar.`);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Selecione um arquivo CSV"); return; }
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const mapped = rows.map(mapRow);
      const chunks = [];
      for (let i = 0; i < mapped.length; i += 100) chunks.push(mapped.slice(i, i + 100));
      let total = 0;
      for (const chunk of chunks) {
        const { error, count } = await supabase.from("leads").insert(chunk);
        if (error) throw error;
        total += chunk.length;
      }
      toast.success(`${total} leads importados com sucesso!`);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      refetch();
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const exportCsv = () => {
    if (!leads?.length) return;
    const headers = ["empresa", "nome_negocio", "etapa", "estado_negocio", "contato_nome", "contato_email", "contato_telefone", "responsavel", "produtos", "categoria"];
    const rows = leads.map(l => headers.map(h => (l as any)[h] || "").join(","));
    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "crm_leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">CRM Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Base interna de leads — importe planilhas CSV</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Upload Section */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4" /> Importar Planilha CSV
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Colunas reconhecidas automaticamente: <code>empresa, contato_nome, email, telefone, etapa, status, responsavel, produtos, categoria</code>.
          Separador vírgula ou ponto-e
cat > src/pages/CrmLeads.tsx << 'ENDOFFILE'
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLeads } from "@/hooks/useLeads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, FileText, Search, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).map(line => {
    const vals = line.split(/[,;]/);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || "").trim()]));
  });
}

function mapRow(row: Record<string, string>) {
  const get = (...keys: string[]) => keys.map(k => row[k]).find(v => v) || null;
  return {
    empresa: get("empresa", "razao_social", "company", "nome_empresa") || "—",
    nome_negocio: get("nome_negocio", "negocio", "deal", "oportunidade"),
    contato_nome: get("contato_nome", "contato", "nome", "contact"),
    contato_email: get("contato_email", "email", "e_mail"),
    contato_telefone: get("contato_telefone", "telefone", "phone", "celular"),
    etapa: get("etapa", "stage", "fase"),
    estado_negocio: get("estado_negocio", "status", "estado"),
    responsavel: get("responsavel", "responsavel_csv", "owner", "vendedor"),
    produtos: get("produtos", "produto", "servico", "product"),
    categoria: get("categoria", "portaria", "funil") || "portaria_145_2022",
    origem_lead: "csv_import",
  };
}

export default function CrmLeads() {
  const { data: leads, isLoading, refetch } = useLeads();
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = (leads || []).filter(l =>
    !search || l.empresa.toLowerCase().includes(search.toLowerCase()) ||
    (l.contato_nome || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.contato_email || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (!rows.length) { toast.error("CSV vazio ou formato inválido"); return; }
      setPreview(rows.slice(0, 5));
      toast.info(`${rows.length} linhas detectadas. Clique em "Confirmar Importação" para salvar.`);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Selecione um arquivo CSV"); return; }
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const mapped = rows.map(mapRow);
      const chunks = [];
      for (let i = 0; i < mapped.length; i += 100) chunks.push(mapped.slice(i, i + 100));
      let total = 0;
      for (const chunk of chunks) {
        const { error, count } = await supabase.from("leads").insert(chunk);
        if (error) throw error;
        total += chunk.length;
      }
      toast.success(`${total} leads importados com sucesso!`);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      refetch();
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const exportCsv = () => {
    if (!leads?.length) return;
    const headers = ["empresa", "nome_negocio", "etapa", "estado_negocio", "contato_nome", "contato_email", "contato_telefone", "responsavel", "produtos", "categoria"];
    const rows = leads.map(l => headers.map(h => (l as any)[h] || "").join(","));
    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "crm_leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">CRM Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Base interna de leads — importe planilhas CSV</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Upload Section */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4" /> Importar Planilha CSV
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Colunas reconhecidas automaticamente: <code>empresa, contato_nome, email, telefone, etapa, status, responsavel, produtos, categoria</code>.
          Separador vírgula ou ponto-e-vírgula.
        </p>
        <div className="flex gap-3 flex-wrap">
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange}
            className="flex-1 min-w-[200px] text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground cursor-pointer border border-input rounded-md px-3 py-2" />
          <Button onClick={handleImport} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {importing ? "Importando..." : "Confirmar Importação"}
          </Button>
        </div>

        {preview && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Prévia (5 primeiras linhas):</p>
            <div className="overflow-x-auto rounded border text-xs">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>{Object.keys(preview[0]).map(h => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t">
                      {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1 truncate max-w-[120px]">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Search + Table */}
      <div className="bento-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar empresa, contato, email..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="secondary">{filtered.length} leads</Badge>
        </div>

        {isLoading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum lead encontrado</p>
            <p className="text-xs mt-1">Importe um CSV acima para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((l) => (
                  <TableRow key={l.id} className="hover:bg-muted/50">
                    <TableCell>
                      <p className="font-medium text-sm">{l.empresa}</p>
                      {l.produtos && <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{l.produtos}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.nome_negocio || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.etapa || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.estado_negocio === "Vendida" ? "default" : l.estado_negocio === "Perdida" ? "destructive" : "secondary"} className="text-xs">
                        {l.estado_negocio || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{l.contato_nome || "—"}</div>
                      {l.contato_email && <div className="text-[10px]">{l.contato_email}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.responsavel_csv || l.responsavel || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{l.categoria}</Badge>
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
