import { cn } from "@/lib/utils";

type Urgency = "hot" | "vencido" | "medio" | "normal";

const urgencyConfig: Record<Urgency, { label: string; emoji: string; className: string }> = {
  hot: { label: "Quente", emoji: "🔥", className: "urgency-hot" },
  vencido: { label: "Vencido", emoji: "⚠️", className: "urgency-vencido" },
  medio: { label: "Médio", emoji: "⏳", className: "urgency-medio" },
  normal: { label: "Normal", emoji: "✅", className: "urgency-normal" },
};

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const config = urgencyConfig[urgency as Urgency] || urgencyConfig.normal;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", config.className)}>
      {config.emoji} {config.label}
    </span>
  );
}

export function LeadScoreBadge({ score }: { score: number }) {
  if (score >= 8) return <span className="lead-score-hot">🔥 {score}/10</span>;
  if (score >= 5) return <span className="lead-score-warm">⭐ {score}/10</span>;
  return <span className="lead-score-cold">➕ {score}/10</span>;
}

export function CrmStatusBadge({ status }: { status: string }) {
  const config: Record<string, { emoji: string; label: string; className: string }> = {
    novo: { emoji: "🆕", label: "Novo", className: "bg-blue-100 text-blue-700" },
    contatado: { emoji: "✔️", label: "Contatado", className: "bg-emerald-100 text-emerald-700" },
    vendida: { emoji: "✅", label: "Vendida", className: "bg-green-100 text-green-700" },
    perdida: { emoji: "❌", label: "Perdida", className: "bg-red-100 text-red-700" },
    em_andamento: { emoji: "🔄", label: "Em Andamento", className: "bg-amber-100 text-amber-700" },
    nao_prospectar: { emoji: "🚫", label: "Não Prospectar", className: "bg-gray-100 text-gray-500" },
  };
  const c = config[status] || config.novo;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", c.className)}>
      {c.emoji} {c.label}
    </span>
  );
}
