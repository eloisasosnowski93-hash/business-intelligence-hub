import { useState } from "react";
import { useLeads, CATEGORIA_LABELS, Lead } from "@/hooks/useLeads";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CrmStatusBadge } from "@/components/Badges";
import { Search, Loader2, Mail, Phone, User } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ESTADO_COLORS: Record<string, string> = {
  "Vendida": "bg-emerald-100 text-emerald-700",
  "Perdida": "bg-red-100 text-red-700",
  "Em Andamento": "bg-amber-100 text-amber-700",
};

export default function CrmLeads() {
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const { data: leads, isLoading } = useLeads();

  const filtered = (leads || []).filter((l) => {
    if (categoriaFilter !== "all" && l.categoria !== categoriaFilter) return false;
    if (estadoFilter !== "all" && l.estado_negocio !== estadoFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        l.empresa.toLowerCase().includes(s) ||
        (l.contato_nome?.toLowerCase().includes(s)) ||
        (l.contato_email?.toLowerCase().includes(s)) ||
        (l.nome_negocio?.toLowerCase().includes(s))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">CRM Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {leads?.length || 0} leads importados · Todas as portarias
        </p>
      </div>

      {/* Filters */}
      <div className="bento-card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Buscar empresa, contato, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-full md:w-[260px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Vendida">Vendida</SelectItem>
              <SelectItem value="Perdida">Perdida</SelectItem>
              <SelectItem value="Em Andamento">Em Andamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="bento-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground text-sm">{l.empresa}</p>
                      {l.nome_negocio && (
                        <p className="text-xs text-muted-foreground">{l.nome_negocio}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {CATEGORIA_LABELS[l.categoria]?.split("—")[0]?.trim() || l.categoria}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.etapa || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLORS[l.estado_negocio || ""] || "bg-muted text-muted-foreground"}`}>
                      {l.estado_negocio || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {l.contato_nome && (
                        <div className="flex items-center gap-1 text-xs text-foreground">
                          <User className="h-3 w-3" /> {l.contato_nome}
                        </div>
                      )}
                      {l.contato_email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {l.contato_email}
                        </div>
                      )}
                      {l.contato_telefone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {l.contato_telefone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.responsavel_csv || l.responsavel || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 100 && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Exibindo 100 de {filtered.length} leads. Use os filtros para refinar.
            </p>
          )}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Nenhum lead encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
