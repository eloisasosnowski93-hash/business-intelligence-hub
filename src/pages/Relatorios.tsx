import { useLeadStats, useLeads, CATEGORIA_LABELS } from "@/hooks/useLeads";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { Download, Users, TrendingUp, DollarSign, AlertCircle } from "lucide-react";

const COLORS = ["#7c3aed", "#a855f7", "#c084fc", "#e9d5ff", "#6d28d9", "#4c1d95", "#8b5cf6"];

export default function Relatorios() {
  const { data: stats, isLoading } = useLeadStats();
  const { data: leads } = useLeads();

  const exportCsv = () => {
    if (!leads?.length) return;
    const headers = ["empresa","nome_negocio","etapa","estado_negocio","contato_nome","contato_email","contato_telefone","responsavel","produtos","categoria","created_at"];
    const rows = leads.map(l => headers.map(h => {
      const v = (l as any)[h] || "";
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(","));
    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio_leads_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!stats) return null;

  const byCategoria = Object.entries(stats.byCategoria).map(([k, v]) => ({
    name: CATEGORIA_LABELS[k] ? CATEGORIA_LABELS[k].split("—")[0].trim() : k,
    total: v,
  }));

  const byEstado = Object.entries(stats.byEstado).map(([k, v]) => ({ name: k, total: v }));
  const byEtapa = Object.entries(stats.byEtapa).map(([k, v]) => ({ name: k, total: v })).sort((a,b) => b.total - a.total).slice(0, 8);

  const pieData = [
    { name: "Vendidas", value: stats.vendidas },
    { name: "Perdidas", value: stats.perdidas },
    { name: "Em Andamento", value: stats.emAndamento },
    { name: "Outros", value: stats.total - stats.vendidas - stats.perdidas - stats.emAndamento },
  ].filter(d => d.value > 0);

  const taxaConversao = stats.total > 0 ? ((stats.vendidas / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Análise da base de leads e performance</p>
        </div>
        <Button onClick={exportCsv} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV Completo
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Leads" value={stats.total} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Vendidas" value={stats.vendidas} icon={<TrendingUp className="h-5 w-5" />} trend="positive" />
        <StatCard title="Taxa de Conversão" value={`${taxaConversao}%`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Valor Total" value={`R$ ${(stats.totalValor/1000).toFixed(0)}k`} icon={<DollarSign className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pizza — Status */}
        <div className="bento-card">
          <h3 className="text-sm font-heading font-semibold mb-4">Status dos Negócios</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados suficientes</p>}
        </div>

        {/* Barra — Por Categoria */}
        <div className="bento-card">
          <h3 className="text-sm font-heading font-semibold mb-4">Leads por Portaria / Categoria</h3>
          {byCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategoria} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="total" fill="#7c3aed" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
        </div>

        {/* Barra — Por Etapa */}
        <div className="bento-card">
          <h3 className="text-sm font-heading font-semibold mb-4">Leads por Etapa do Funil</h3>
          {byEtapa.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byEtapa}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#a855f7" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
        </div>

        {/* Barra — Por Estado do Negócio */}
        <div className="bento-card">
          <h3 className="text-sm font-heading font-semibold mb-4">Leads por Estado do Negócio</h3>
          {byEstado.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byEstado}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#6d28d9" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
        </div>
      </div>
    </div>
  );
}
