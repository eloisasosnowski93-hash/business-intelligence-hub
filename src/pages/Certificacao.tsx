import { ShieldCheck } from "lucide-react";

export default function Certificacao() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Certificação OCP</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestão de certificações e portarias
        </p>
      </div>
      <div className="bento-card text-center py-12">
        <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Em breve: Gestão de certificados por portaria (384/2020 e 145/2022)
        </p>
      </div>
    </div>
  );
}
