import { useState } from "react";
import { useLeads, CATEGORIA_LABELS, Lead } from "@/hooks/useLeads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Loader2, Mail } from "lucide-react";

const OCP_CATEGORIAS = ["portaria_145_2022", "portaria_384_2020"];

export default function Certificacao() {
  const [filterCat, setFilterCat] = useState("todas");
  const { data: allLeads, isLoading } = useLeads();

  const ocpLeads = (allLeads || []).filter(l => OCP_CATEGORIAS.includes(l.categoria));
  const filtered = filterCat === "todas" ? ocpLeads : ocpLeads.filter(l => l.categoria === filterCat);

  const byCategoria = OCP_CATEGORIAS.map(cat => ({
    key: cat,
    label: CATEGORIA_LABELS[cat] || cat,
    count: ocpLeads.filter(l => l.categoria === cat).length,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Certificação OCP</h1>
          <p className="text-sm text-muted-foreground mt-1">Leads vinculados às portarias OCP — Scitec Inspeções e Certificações</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card text-center">
          <p className="text-3xl font-bold text-foreground">{ocpLeads.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total OCP</p>
        </div>
        {byCategoria.map(c => (
          <div key={c.key} className="bento-card text-center">
            <p className="text-3xl font-bold text-foreground">{c.count}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label.split("—")[0].trim()}</p>
          </div>
        ))}
        <div className="bento-card text-center">
          <p className="text-3xl font-bold text-foreground">
            {ocpLeads.filter(l => l.estado_negocio === "Vendida").length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Vendidas</p>
        </div>
      </div>

      {/* Filtro */}
      <div className="bento-card">
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" variant={filterCat === "todas" ? "default" : "outline"} onClick={() => setFilterCat("todas")} className="text-xs">
            Todas ({ocpLeads.length})
          </Button>
          {byCategoria.map(c => (
            <Button key={c.key} size="sm" variant={filterCat === c.key ? "default" : "outline"}
              onClick={() => setFilterCat(c.key)} className="text-xs">
              {c.label.split("—")[0].trim()} ({c.count})
            </Button>
          ))}
        </div>

        <h3 className="text-sm font-heading font-semibold mb-4">Leads OCP</h3>
        {isLoading ? (
          <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-12">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhum lead OCP encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map(l => (
                  <TableRow key={l.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-sm">{l.empresa}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.nome_negocio || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{CATEGORIA_LABELS[l.categoria]?.split("—")[0]?.trim() || l.categoria}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.etapa || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.estado_negocio === "Vendida" ? "default" : l.estado_negocio === "Perdida" ? "destructive" : "secondary"} className="text-xs">
                        {l.estado_negocio || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.contato_nome || "—"}
                      {l.contato_email && <div className="text-[10px]">{l.contato_email}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.responsavel_csv || l.responsavel || "—"}</TableCell>
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
