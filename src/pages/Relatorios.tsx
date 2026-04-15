import { FileBarChart } from "lucide-react";

export default function Relatorios() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Análises e exportações de dados
        </p>
      </div>
      <div className="bento-card text-center py-12">
        <FileBarChart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Em breve: Relatórios de prospecção, conversão e performance por portaria
        </p>
      </div>
    </div>
  );
}
