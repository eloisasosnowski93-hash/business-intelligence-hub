import { useLeads, CATEGORIA_LABELS } from "@/hooks/useLeads";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, FlaskConical, User, Mail, Phone } from "lucide-react";

export default function Endotoxina() {
  const { data: leads, isLoading } = useLeads("endotoxina_esterilidade");
  const [search, setSearch] = useState("");

  const filtered = (leads || []).filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.empresa.toLowerCase().includes(s) || (l.contato_nome?.toLowerCase().includes(s)) || (l.contato_email?.toLowerCase().includes(s));
  });

  const stats = {
    total: leads?.length || 0,
    vendidas: leads?.filter(l => l.estado_negocio === "Vendida").length || 0,
    perdidas: leads?.filter(l => l.estado_negocio === "Perdida").length || 0,
    emAndamento: leads?.filter(l => l.estado_negocio === "Em Andamento").length || 0,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Endotoxina & Esterilidade</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Leads de ensaios de Endotoxina, Esterilidade e Bioburden · Responsável: Kevin
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bento-card text-center">
          <p className="stat-value text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="bento-card text-center border-l-4 border-l-emerald-500">
          <p className="stat-value text-emerald-600">{stats.vendidas}</p>
          <p className="text-xs text-muted-foreground">Vendidas</p>
        </div>
        <div className="bento-card text-center border-l-4 border-l-amber-500">
          <p className="stat-value text-amber-600">{stats.emAndamento}</p>
          <p className="text-xs text-muted-foreground">Em Andamento</p>
        </div>
        <div className="bento-card text-center border-l-4 border-l-red-500">
          <p className="stat-value text-red-600">{stats.perdidas}</p>
          <p className="text-xs text-muted-foreground">Perdidas</p>
        </div>
      </div>

      <div className="bento-card">
        <div className="flex items-center gap-3 mb-4">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-heading font-semibold text-foreground">Leads — Endotoxina, Esterilidade & Bioburden</h3>
        </div>
        <Input
          placeholder="Buscar empresa, contato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-md"
        />
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Motivo Perda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <p className="font-medium text-foreground text-sm">{l.empresa}</p>
                      {l.nome_negocio && <p className="text-xs text-muted-foreground">{l.nome_negocio}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{l.etapa || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.estado_negocio === "Vendida" ? "default" : l.estado_negocio === "Perdida" ? "destructive" : "secondary"} className="text-xs">
                        {l.estado_negocio || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        {l.contato_nome && <div className="flex items-center gap-1"><User className="h-3 w-3" /> {l.contato_nome}</div>}
                        {l.contato_email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {l.contato_email}</div>}
                        {l.contato_telefone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {l.contato_telefone}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.motivo_perda !== "Nada" ? l.motivo_perda : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && (
              <div className="py-8 text-center text-muted-foreground"><Search className="h-8 w-8 mx-auto mb-2" /><p>Nenhum lead encontrado</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
