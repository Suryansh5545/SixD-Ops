import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "success" | "warning" | "danger";
  loading?: boolean;
}

const variantStyles = {
  default: "bg-card border",
  success: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
  warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
  danger: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
};

const iconStyles = {
  default: "bg-brand-100 text-brand-600",
  success: "bg-green-100 text-green-600",
  warning: "bg-yellow-100 text-yellow-700",
  danger: "bg-red-100 text-red-600",
};

/**
 * Stat card for dashboard overview widgets.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border p-5 space-y-3">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-8 w-32 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl p-5 flex flex-col gap-3", variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <div className={cn("p-2 rounded-lg", iconStyles[variant])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {trend && (
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-xs font-medium",
              trend.value >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {trend.value >= 0 ? "+" : ""}{trend.value}%
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
