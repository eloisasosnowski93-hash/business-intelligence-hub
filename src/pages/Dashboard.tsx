import { useUnit } from "@/contexts/UnitContext";
import { StatCard } from "@/components/StatCard";
import { UrgencyBadge, CrmStatusBadge, LeadScoreBadge } from "@/components/Badges";
import { Flame, AlertTriangle, Clock, CheckCircle, Users, TrendingUp, Search, Zap } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// Demo data
const demoLeads = [
  { id: 1, nome: "MagNamed Tecnologia Médica", cnpj: "12.345.678/0001-01", email: "contato@magnamed.com.br", telefone: "(11) 3456-7890", decisor: "Dr. Carlos Almeida", urgencia: "hot", status_crm: "novo", estado: "SP", cidade: "São Paulo", score: 10, portaria: "145/2022", validade: "2024-06-15" },
  { id: 2, nome: "Bioparts Implantes", cnpj: "98.765.432/0001-02", email: "vendas@bioparts.com.br", telefone: "(41) 9999-8888", decisor: "Ana Lima", urgencia: "vencido", status_crm: "contatado", estado: "PR", cidade: "Curitiba", score: 8, portaria: "384/2020", validade: "2024-01-10" },
  { id: 3, nome: "OrthoTech Solutions", cnpj: "11.222.333/0001-03", email: "info@orthotech.com", telefone: "(21) 2222-3333", decisor: "Roberto Pires", urgencia: "medio", status_crm: "em_andamento", estado: "RJ", cidade: "Rio de Janeiro", score: 5, portaria: "145/2022", validade: "2025-03-20" },
  { id: 4, nome: "Dental Pro Fabricação", cnpj: "44.555.666/0001-04", email: "fabrica@dentalpro.com", telefone: "(31) 4444-5555", decisor: "", urgencia: "normal", status_crm: "novo", estado: "MG", cidade: "Belo Horizonte", score: 3, portaria: "384/2020", validade: "2026-01-01" },
  { id: 5, nome: "SterilMed Equipamentos", cnpj: "77.888.999/0001-05", email: "rh@sterilmed.com.br", telefone: "(51) 7777-8888", decisor: "Lucia Ferreira", urgencia: "hot", status_crm: "vendida", estado: "RS", cidade: "Porto Alegre", score: 9, portaria: "145/2022", validade: "2024-08-01" },
  { id: 6, nome: "NovaBio Implantes Ltda", cnpj: "55.444.333/0001-06", email: "", telefone: "(19) 3322-1100", decisor: "Pedro Nunes", urgencia: "medio", status_crm: "novo", estado: "SP", cidade: "Campinas", score: 6, portaria: "384/2020", validade: "2025-07-15" },
];

const distEstados = [
  { estado: "SP", count: 42, pct: 35 },
  { estado: "PR", count: 18, pct: 15 },
  { estado: "RJ", count: 15, pct: 12 },
  { estado: "MG", count: 12, pct: 10 },
  { estado: "RS", count: 10, pct: 8 },
  { estado: "SC", count: 8, pct: 7 },
];

export default function Dashboard() {
  const { unit, unitLabel } = useUnit();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const stats = {
    total: 120,
    hot: 23,
    vencido: 15,
    medio: 34,
    normal: 38,
    contatado: 10,
  };

  const filteredLeads = demoLeads.filter((l) => {
    if (activeFilter && activeFilter !== "todos") {
      if (activeFilter === "contatado" && l.status_crm !== "contatado") return false;
      if (["hot", "vencido", "medio", "normal"].includes(activeFilter) && l.urgencia !== activeFilter) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return l.nome.toLowerCase().includes(s) || l.cnpj.includes(s) || l.cidade.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Painel de Inteligência
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão geral · {unitLabel}
        </p>
      </div>

      {/* Bento Grid - Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total INMETRO"
          value={stats.total}
          icon={<Users className="h-4 w-4" />}
          onClick={() => setActiveFilter("todos")}
          active={activeFilter === "todos"}
        />
        <StatCard
          label="Quentes"
          value={stats.hot}
          variant="hot"
          icon={<Flame className="h-4 w-4" />}
          onClick={() => setActiveFilter("hot")}
          active={activeFilter === "hot"}
        />
        <StatCard
          label="Vencidos"
          value={stats.vencido}
          variant="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
          onClick={() => setActiveFilter("vencido")}
          active={activeFilter === "vencido"}
        />
        <StatCard
          label="Médio Prazo"
          value={stats.medio}
          variant="accent"
          icon={<Clock className="h-4 w-4" />}
          onClick={() => setActiveFilter("medio")}
          active={activeFilter === "medio"}
        />
        <StatCard
          label="Normal"
          value={stats.normal}
          variant="success"
          icon={<CheckCircle className="h-4 w-4" />}
          onClick={() => setActiveFilter("normal")}
          active={activeFilter === "normal"}
        />
        <StatCard
          label="Contatados"
          value={stats.contatado}
          icon={<TrendingUp className="h-4 w-4" />}
          onClick={() => setActiveFilter("contatado")}
          active={activeFilter === "contatado"}
        />
      </div>

      {/* Bento Grid - Charts + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribution by State */}
        <div className="bento-card lg:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">📍 Leads por Estado</h3>
          <div className="space-y-3">
            {distEstados.map((d) => (
              <div key={d.estado} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-foreground min-w-[28px]">{d.estado}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                  {d.count} ({d.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bento-card lg:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">⚡ Ações Rápidas</h3>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
              <Search className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Nova Prospecção</p>
                <p className="text-xs text-muted-foreground">Buscar leads por CNAE/Portaria</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
              <Zap className="h-4 w-4 text-accent" />
              <div>
                <p className="text-sm font-medium text-foreground">Enriquecer Lead</p>
                <p className="text-xs text-muted-foreground">CNPJ + BrasilAPI + LinkedIn</p>
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
              <TrendingUp className="h-4 w-4 text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">Recontatar</p>
                <p className="text-xs text-muted-foreground">3 leads para follow-up</p>
              </div>
            </button>
          </div>
        </div>

        {/* Performance CRM */}
        <div className="bento-card lg:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">📊 Performance CRM</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="stat-value text-lg text-foreground">48</p>
              <p className="text-xs text-muted-foreground">Total CRM</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="stat-value text-lg text-success">12</p>
              <p className="text-xs text-muted-foreground">Ganhos</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="stat-value text-lg text-hot">8</p>
              <p className="text-xs text-muted-foreground">Perdidos</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="stat-value text-lg text-accent">60%</p>
              <p className="text-xs text-muted-foreground">Conversão</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bento-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-heading font-semibold text-foreground">
            {activeFilter ? `Leads — ${activeFilter}` : "Últimos Leads"}
          </h3>
          <div className="flex gap-2 items-center">
            {activeFilter && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setActiveFilter(null)}
              >
                ✕ Limpar filtro
              </Badge>
            )}
            <Input
              placeholder="Buscar por nome, CNPJ, cidade..."
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
                <TableHead>Urgência</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Decisor</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>CRM</TableHead>
                <TableHead>Portaria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell><UrgencyBadge urgency={lead.urgencia} /></TableCell>
                  <TableCell className="font-medium text-foreground">{lead.nome}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{lead.cnpj}</TableCell>
                  <TableCell><LeadScoreBadge score={lead.score} /></TableCell>
                  <TableCell className="text-sm">{lead.decisor || "—"}</TableCell>
                  <TableCell>{lead.estado}</TableCell>
                  <TableCell><CrmStatusBadge status={lead.status_crm} /></TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{lead.portaria}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            Nenhum lead encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
