import { Search, Zap } from "lucide-react";

export default function Enriquecimento() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Enriquecimento de Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Busca multi-fonte para enriquecer dados de leads
        </p>
      </div>
      <div className="bento-card text-center py-12">
        <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Em breve: Enriquecimento automático com BrasilAPI + LinkedIn
        </p>
      </div>
    </div>
  );
}
