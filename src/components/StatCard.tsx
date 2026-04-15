import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  variant?: "default" | "hot" | "warning" | "success" | "accent";
  onClick?: () => void;
  active?: boolean;
}

const variantStyles = {
  default: "border-border",
  hot: "border-l-4 border-l-hot",
  warning: "border-l-4 border-l-warning",
  success: "border-l-4 border-l-success",
  accent: "border-l-4 border-l-accent",
};

export function StatCard({ label, value, icon, variant = "default", onClick, active }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bento-card text-left w-full animate-slide-up",
        variantStyles[variant],
        onClick && "cursor-pointer",
        active && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="stat-value text-foreground animate-count-up">{value}</div>
    </button>
  );
}
