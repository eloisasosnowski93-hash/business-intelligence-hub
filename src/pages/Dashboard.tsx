import { useUnit } from "@/contexts/UnitContext";
import { useLeadStats, useLeads, CATEGORIA_LABELS, CATEGORIA_RESPONSAVEL } from "@/hooks/useLeads";
import { StatCard } from "@/components/StatCard";
import { CrmStatusBadge } from "@/components/Badges";
import { Flame, AlertTriangle, Clock, CheckCircle, Users, TrendingUp, Search, Zap, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { unit, unitLabel } = useUnit();
  const { data: stats, isLoading: statsLoading } = useLeadStats();
  const { data: leads, isLoading: leadsLoading } = useLeads();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  const filteredLeads = (leads || []).filter((l) => {
    if (activeFilter && activeFilter !== "todos") {
      if (activeFilter === "Vendida" && l.estado_negocio !== "Vendida") return false;
      if (activeFilter === "Perdida" && l.estado_negocio !== "Perdida") return false;
      if (activeFilter === "Em Andamento" && l.estado_negocio !== "Em Andamento") return false;
      if (Object.keys(CATEGORIA_LABELS).includes(activeFilter) && l.categoria !== activeFilter) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return l.empresa.toLowerCase().includes(s) || (l.contato_nome?.toLowerCase().includes(s));
    }
    return true;
  }).slice(0, 50);

  const categoriaEntries = Object.entries(stats?.byCategoria || {}).sort((a, b) => b[1] - a[1]);
  const etapaEntries = Object.entries(stats?.byEtapa || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Painel de Inteligência</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral · {unitLabel} · {stats?.total || 0} leads</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Leads"
          value={stats?.total || 0}
          icon={<Users className="h-4 w-4" />}
          onClick={() => setActiveFilter("todos")}
          active={activeFilter === "todos"}
        />
        <StatCard
          label="Vendidas"
          value={stats?.vendidas || 0}
          variant="success"
          icon={<CheckCircle className="h-4 w-4" />}
          onClick={() => setActiveFilter("Vendida")}
          active={activeFilter === "Vendida"}
        />
        <StatCard
          label="Em Andamento"
          value={stats?.emAndamento || 0}
          variant="accent"
          icon={<Clock className="h-4 w-4" />}
          onClick={() => setActiveFilter("Em Andamento")}
          active={activeFilter === "Em Andamento"}
        />
        <StatCard
          label="Perdidas"
          value={stats?.perdidas || 0}
          variant="hot"
          icon={<AlertTriangle className="h-4 w-4" />}
          onClick={() => setActiveFilter("Perdida")}
          active={activeFilter === "Perdida"}
        />
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* By Categoria / Portaria */}
        <div className="bento-card lg:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">📋 Leads por Portaria</h3>
          <div className="space-y-3">
            {categoriaEntries.map(([cat, count]) => {
              const pct = stats ? Math.round((count / stats.total) * 100) : 0;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`w-full text-left ${activeFilter === cat ? "ring-2 ring-primary rounded-lg" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground truncate flex-1">
                      {CATEGORIA_LABELS[cat]?.split("—")[0]?.trim() || cat}
                    </span>
                    <span className="text-xs text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Resp: {CATEGORIA_RESPONSAVEL[cat] || "—"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* By Etapa */}
        <div className="bento-card lg:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">📊 Funil de Etapas</h3>
          <div className="space-y-2">
            {etapaEntries.map(([etapa, count]) => (
              <div key={etapa} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-xs text-foreground">{etapa}</span>
                <Badge variant="secondary" className="text-xs">{count}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bento-card lg:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">⚡ Ações Rápidas</h3>
          <div className="space-y-2">
            <button onClick={() => navigate("/prospeccao")} className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
              <Search className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Nova Prospecção</p>
                <p className="text-xs text-muted-foreground">Buscar leads por CNPJ/CNAE</p>
              </div>
            </button>
            <button onClick={() => navigate("/crm")} className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">CRM Leads</p>
                <p className="text-xs text-muted-foreground">{stats?.total || 0} leads cadastrados</p>
              </div>
            </button>
            <button onClick={() => navigate("/endotoxina")} className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
              <Zap className="h-4 w-4 text-accent" />
              <div>
                <p className="text-sm font-medium text-foreground">Endotoxina & Esterilidade</p>
                <p className="text-xs text-muted-foreground">{stats?.byCategoria?.endotoxina_esterilidade || 0} leads</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bento-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-heading font-semibold text-foreground">
            {activeFilter && activeFilter !== "todos"
              ? `Leads — ${CATEGORIA_LABELS[activeFilter] || activeFilter}`
              : "Últimos Leads"}
          </h3>
          <div className="flex gap-2 items-center">
            {activeFilter && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setActiveFilter(null)}>
                ✕ Limpar
              </Badge>
            )}
            <Input
              placeholder="Buscar empresa, contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Contato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground text-sm">{lead.empresa}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                      {CATEGORIA_LABELS[lead.categoria]?.split("—")[0]?.trim() || lead.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.etapa || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={lead.estado_negocio === "Vendida" ? "default" : lead.estado_negocio === "Perdida" ? "destructive" : "secondary"} className="text-xs">
                      {lead.estado_negocio || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.responsavel_csv || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{lead.contato_nome || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">Nenhum lead encontrado.</div>
        )}
      </div>
    </div>
  );
}
