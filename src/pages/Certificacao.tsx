import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Plus, Trash2, Bell, AlertTriangle, CheckCircle, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Certificado {
  id: string;
  certificado: string;
  portaria: string;
  titular: string;
  validade: string;
  alerta_dias: number;
  created_at: string;
}

const PORTARIAS = [
  { value: "071/2022", label: "Portaria 071/2022" },
  { value: "145/2022", label: "Portaria 145/2022 — Componentes Automotivos" },
  { value: "501/2021", label: "Portaria 501/2021 — Rodas" },
  { value: "384/2020", label: "Portaria 384/2020 — Equip. Vigilância Sanitária" },
  { value: "outro", label: "Outro" },
];

const TITULARES = [
  "Scitec Inspeções e Certificações",
  "Scitec Certificações",
  "Scitec Laboratório",
];

function diasParaVencer(validade: string): number {
  return Math.ceil((new Date(validade).getTime() - new Date().getTime()) / 86400000);
}

function StatusBadge({ dias }: { dias: number }) {
  if (dias < 0) return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Vencido há {Math.abs(dias)}d</Badge>;
  if (dias <= 90) return <Badge className="text-xs gap-1 bg-red-100 text-red-700 border-red-200 hover:bg-red-100"><AlertTriangle className="h-3 w-3" />Crítico — {dias}d</Badge>;
  if (dias <= 180) return <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"><Bell className="h-3 w-3" />Atenção — {dias}d</Badge>;
  return <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100"><CheckCircle className="h-3 w-3" />Ativo — {dias}d</Badge>;
}

export default function Certificacao() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ certificado: "", portaria: "145/2022", titular: "Scitec Inspeções e Certificações", validade: "", alerta_dias: 90 });
  const [adding, setAdding] = useState(false);
  const [filterPortaria, setFilterPortaria] = useState("todas");
  const notifEmail = localStorage.getItem("notif_email") || "";

  const { data: certs, isLoading } = useQuery<Certificado[]>({
    queryKey: ["certificados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("certificados_ocp").select("*").order("validade");
      if (error) throw error;
      return (data || []) as Certificado[];
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
        titular: form.titular,
        validade: form.validade,
        alerta_dias: form.alerta_dias,
      });
      if (error) throw error;
      toast.success("Certificado cadastrado!");
      setForm({ certificado: "", portaria: "145/2022", titular: "Scitec Inspeções e Certificações", validade: "", alerta_dias: 90 });
      qc.invalidateQueries({ queryKey: ["certificados"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setAdding(false); }
  };

  const handleNotificar = () => {
    const criticos = (certs || []).filter(c => diasParaVencer(c.validade) <= Number(localStorage.getItem("notif_dias") || 90));
    if (!criticos.length) { toast.info("Nenhum certificado crítico no momento"); return; }
    if (!notifEmail) { toast.error("Configure o e-mail de notificação em Configurações"); return; }
    const corpo = criticos.map(c => `${c.certificado} (${c.portaria}) — Titular: ${c.titular} — Vence: ${new Date(c.validade + "T00:00:00").toLocaleDateString("pt-BR")} — ${diasParaVencer(c.validade) < 0 ? "VENCIDO" : diasParaVencer(c.validade) + " dias"}`).join("\n");
    const subject = encodeURIComponent(`[Scitec] ${criticos.length} certificado(s) próximo(s) do vencimento`);
    const body = encodeURIComponent(`Certificados que precisam de atenção:\n\n${corpo}\n\nAcesse o sistema para mais detalhes.`);
    window.open(`mailto:${notifEmail}?subject=${subject}&body=${body}`);
    toast.success("Cliente de e-mail aberto com os alertas!");
  };

  const filtered = (certs || []).filter(c => filterPortaria === "todas" || c.portaria === filterPortaria);
  const vencidos = (certs || []).filter(c => diasParaVencer(c.validade) < 0);
  const criticos90 = (certs || []).filter(c => { const d = diasParaVencer(c.validade); return d >= 0 && d <= 90; });
  const atencao180 = (certs || []).filter(c => { const d = diasParaVencer(c.validade); return d > 90 && d <= 180; });
  const ativos = (certs || []).filter(c => diasParaVencer(c.validade) > 180);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Certificação OCP</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de certificados — Scitec Inspeções e Certificações</p>
        </div>
        <Button onClick={handleNotificar} variant="outline" className="gap-2">
          <Mail className="h-4 w-4" /> Enviar Alertas por E-mail
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card text-center">
          <p className="text-3xl font-bold text-foreground">{(certs || []).length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total de Certificados</p>
        </div>
        <div className="bento-card text-center">
          <p className="text-3xl font-bold text-green-600">{ativos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Ativos (+180 dias)</p>
        </div>
        <div className="bento-card text-center">
          <p className="text-3xl font-bold text-amber-600">{atencao180.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Atenção (90–180 dias)</p>
        </div>
        <div className="bento-card text-center">
          <p className="text-3xl font-bold text-red-600">{criticos90.length + vencidos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Críticos / Vencidos</p>
        </div>
      </div>

      {/* Alertas críticos */}
      {(vencidos.length > 0 || criticos90.length > 0) && (
        <div className="bento-card border-red-200 bg-red-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-semibold text-red-700">Atenção imediata necessária</h3>
            </div>
            {!notifEmail && (
              <span className="text-xs text-red-600">⚠ Configure e-mail em Configurações para receber alertas</span>
            )}
          </div>
          <div className="space-y-2">
            {[...vencidos, ...criticos90].map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm text-red-700">
                <span className="font-medium">{c.certificado}</span>
                <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">{c.portaria}</Badge>
                <span className="text-xs text-red-500">{c.titular}</span>
                <span className="ml-auto text-xs font-medium">
                  {diasParaVencer(c.validade) < 0 ? "VENCIDO" : `Vence em ${diasParaVencer(c.validade)} dias`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulário */}
      <div className="bento-card">
        <h3 className="text-sm font-heading font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Cadastrar Certificado
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nº Certificado</label>
            <Input placeholder="Ex: OCP-2024-001" value={form.certificado}
              onChange={e => setForm(f => ({ ...f, certificado: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Portaria</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.portaria} onChange={e => setForm(f => ({ ...f, portaria: e.target.value }))}>
              {PORTARIAS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Titular</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.titular} onChange={e => setForm(f => ({ ...f, titular: e.target.value }))}>
              {TITULARES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Validade</label>
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

      {/* Filtro por portaria */}
      <div className="bento-card">
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant={filterPortaria === "todas" ? "default" : "outline"} onClick={() => setFilterPortaria("todas")} className="text-xs">
            Todas ({(certs || []).length})
          </Button>
          {PORTARIAS.map(p => {
            const count = (certs || []).filter(c => c.portaria === p.value).length;
            if (!count) return null;
            return (
              <Button key={p.value} size="sm" variant={filterPortaria === p.value ? "default" : "outline"}
                onClick={() => setFilterPortaria(p.value)} className="text-xs">
                {p.value} ({count})
              </Button>
            );
          })}
        </div>

        <h3 className="text-sm font-heading font-semibold mb-4">Certificados Cadastrados</h3>
        {isLoading ? (
          <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-12">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhum certificado cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">Cadastre os certificados OCP da Scitec acima para monitorar vencimentos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certificado</TableHead>
                  <TableHead>Portaria</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const dias = diasParaVencer(c.validade);
                  return (
                    <TableRow key={c.id} className={dias < 0 ? "bg-red-50" : dias <= 90 ? "bg-red-50/40" : dias <= 180 ? "bg-amber-50/40" : ""}>
                      <TableCell className="font-medium text-sm">{c.certificado}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{c.portaria}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(c as any).titular || "Scitec"}</TableCell>
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
