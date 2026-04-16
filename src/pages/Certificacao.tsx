import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Plus, Trash2, Bell, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Certificado {
  id: string;
  certificado: string;
  portaria: string;
  validade: string;
  alerta_dias: number;
  created_at: string;
}

function diasParaVencer(validade: string): number {
  const hoje = new Date();
  const venc = new Date(validade);
  return Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ dias }: { dias: number }) {
  if (dias < 0) return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Vencido</Badge>;
  if (dias <= 90) return <Badge className="text-xs gap-1 bg-red-100 text-red-700 border-red-200"><AlertTriangle className="h-3 w-3" />Vence em {dias}d</Badge>;
  if (dias <= 180) return <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200"><Bell className="h-3 w-3" />Vence em {dias}d</Badge>;
  return <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3" />Ativo ({dias}d)</Badge>;
}

export default function Certificacao() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ certificado: "", portaria: "384/2020", validade: "", alerta_dias: 90 });
  const [adding, setAdding] = useState(false);

  const { data: certs, isLoading } = useQuery<Certificado[]>({
    queryKey: ["certificados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificados_ocp").select("*").order("validade");
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("certificados_ocp").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["certificados"] }); toast.success("Certificado removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAdd = async () => {
    if (!form.certificado || !form.validade) { toast.error("Preencha número do certificado e validade"); return; }
    setAdding(true);
    try {
      const { error } = await supabase.from("certificados_ocp").insert({
        certificado: form.certificado,
        portaria: form.portaria,
        validade: form.validade,
        alerta_dias: form.alerta_dias,
      });
      if (error) throw error;
      toast.success("Certificado cadastrado!");
      setForm({ certificado: "", portaria: "384/2020", validade: "", alerta_dias: 90 });
      qc.invalidateQueries({ queryKey: ["certificados"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setAdding(false); }
  };

  const vencendo90 = (certs || []).filter(c => { const d = diasParaVencer(c.validade); return d >= 0 && d <= 90; });
  const vencendo180 = (certs || []).filter(c => { const d = diasParaVencer(c.validade); return d > 90 && d <= 180; });
  const vencidos = (certs || []).filter(c => diasParaVencer(c.validade) < 0);
  const ativos = (certs || []).filter(c => diasParaVencer(c.validade) > 180);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Certificação OCP</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão de certificados e alertas de vencimento</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card text-center">
          <p className="text-2xl font-bold text-foreground">{(certs || []).length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total de Certificados</p>
        </div>
        <div className="bento-card text-center border-green-200">
          <p className="text-2xl font-bold text-green-600">{ativos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Ativos (+180 dias)</p>
        </div>
        <div className="bento-card text-center border-amber-200">
          <p className="text-2xl font-bold text-amber-600">{vencendo180.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Atenção (90–180 dias)</p>
        </div>
        <div className="bento-card text-center border-red-200">
          <p className="text-2xl font-bold text-red-600">{vencendo90.length + vencidos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Críticos / Vencidos</p>
        </div>
      </div>

      {/* Alertas críticos */}
      {(vencendo90.length > 0 || vencidos.length > 0) && (
        <div className="bento-card border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-700">Atenção imediata necessária</h3>
          </div>
          <div className="space-y-1">
            {[...vencidos, ...vencendo90].map(c => (
              <div key={c.id} className="text-sm text-red-700 flex items-center gap-2">
                <span className="font-medium">{c.certificado}</span>
                <span className="text-muted-foreground">·</span>
                <span>Portaria {c.portaria}</span>
                <span className="text-muted-foreground">·</span>
                <span>{diasParaVencer(c.validade) < 0 ? "VENCIDO" : `Vence em ${diasParaVencer(c.validade)} dias`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
cat > src/pages/Certificacao.tsx << 'ENDOFFILE'
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Plus, Trash2, Bell, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Certificado {
  id: string;
  certificado: string;
  portaria: string;
  validade: string;
  alerta_dias: number;
  created_at: string;
}

function diasParaVencer(validade: string): number {
  const hoje = new Date();
  const venc = new Date(validade);
  return Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ dias }: { dias: number }) {
  if (dias < 0) return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Vencido</Badge>;
  if (dias <= 90) return <Badge className="text-xs gap-1 bg-red-100 text-red-700 border-red-200"><AlertTriangle className="h-3 w-3" />Vence em {dias}d</Badge>;
  if (dias <= 180) return <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200"><Bell className="h-3 w-3" />Vence em {dias}d</Badge>;
  return <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3" />Ativo ({dias}d)</Badge>;
}

export default function Certificacao() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ certificado: "", portaria: "384/2020", validade: "", alerta_dias: 90 });
  const [adding, setAdding] = useState(false);

  const { data: certs, isLoading } = useQuery<Certificado[]>({
    queryKey: ["certificados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificados_ocp").select("*").order("validade");
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("certificados_ocp").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["certificados"] }); toast.success("Certificado removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAdd = async () => {
    if (!form.certificado || !form.validade) { toast.error("Preencha número do certificado e validade"); return; }
    setAdding(true);
    try {
      const { error } = await supabase.from("certificados_ocp").insert({
        certificado: form.certificado,
        portaria: form.portaria,
        validade: form.validade,
        alerta_dias: form.alerta_dias,
      });
      if (error) throw error;
      toast.success("Certificado cadastrado!");
      setForm({ certificado: "", portaria: "384/2020", validade: "", alerta_dias: 90 });
      qc.invalidateQueries({ queryKey: ["certificados"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setAdding(false); }
  };

  const vencendo90 = (certs || []).filter(c => { const d = diasParaVencer(c.validade); return d >= 0 && d <= 90; });
  const vencendo180 = (certs || []).filter(c => { const d = diasParaVencer(c.validade); return d > 90 && d <= 180; });
  const vencidos = (certs || []).filter(c => diasParaVencer(c.validade) < 0);
  const ativos = (certs || []).filter(c => diasParaVencer(c.validade) > 180);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Certificação OCP</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão de certificados e alertas de vencimento</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card text-center">
          <p className="text-2xl font-bold text-foreground">{(certs || []).length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total de Certificados</p>
        </div>
        <div className="bento-card text-center border-green-200">
          <p className="text-2xl font-bold text-green-600">{ativos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Ativos (+180 dias)</p>
        </div>
        <div className="bento-card text-center border-amber-200">
          <p className="text-2xl font-bold text-amber-600">{vencendo180.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Atenção (90–180 dias)</p>
        </div>
        <div className="bento-card text-center border-red-200">
          <p className="text-2xl font-bold text-red-600">{vencendo90.length + vencidos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Críticos / Vencidos</p>
        </div>
      </div>

      {/* Alertas críticos */}
      {(vencendo90.length > 0 || vencidos.length > 0) && (
        <div className="bento-card border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-700">Atenção imediata necessária</h3>
          </div>
          <div className="space-y-1">
            {[...vencidos, ...vencendo90].map(c => (
              <div key={c.id} className="text-sm text-red-700 flex items-center gap-2">
                <span className="font-medium">{c.certificado}</span>
                <span className="text-muted-foreground">·</span>
                <span>Portaria {c.portaria}</span>
                <span className="text-muted-foreground">·</span>
                <span>{diasParaVencer(c.validade) < 0 ? "VENCIDO" : `Vence em ${diasParaVencer(c.validade)} dias`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulário de cadastro */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Cadastrar Certificado
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nº Certificado</label>
            <Input placeholder="Ex: OCP-2024-001" value={form.certificado}
              onChange={e => setForm(f => ({ ...f, certificado: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Portaria</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.portaria} onChange={e => setForm(f => ({ ...f, portaria: e.target.value }))}>
              <option value="384/2020">Portaria 384/2020</option>
              <option value="145/2022">Portaria 145/2022</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data de Validade</label>
            <Input type="date" value={form.validade}
              onChange={e => setForm(f => ({ ...f, validade: e.target.value }))} />
          </div>
          <div className="flex items-end">
            <Button onClick={handleAdd} disabled={adding} className="w-full gap-2">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Cadastrar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4">Certificados Cadastrados</h3>
        {isLoading ? (
          <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !certs?.length ? (
          <div className="text-center py-12">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhum certificado cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">Cadastre os certificados OCP da Scitec acima para monitorar os vencimentos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificado</TableHead>
                  <TableHead>Portaria</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(certs || []).map(c => {
                  const dias = diasParaVencer(c.validade);
                  return (
                    <TableRow key={c.id} className={dias < 0 ? "bg-red-50" : dias <= 90 ? "bg-red-50/50" : dias <= 180 ? "bg-amber-50/50" : ""}>
                      <TableCell className="font-medium">{c.certificado}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">Portaria {c.portaria}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(c.validade + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell><StatusBadge dias={dias} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
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
