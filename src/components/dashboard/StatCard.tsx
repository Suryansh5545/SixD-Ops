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

const iconStyles = {
  default: "text-muted-foreground",
  success: "text-emerald-600 dark:text-emerald-500",
  warning: "text-amber-600 dark:text-amber-500",
  danger: "text-rose-600 dark:text-rose-500",
};

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
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-5 w-5 rounded" />
        </div>
        <div className="mt-4 skeleton h-8 w-28 rounded-lg" />
        <div className="mt-2 skeleton h-4 w-36 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium tracking-tight text-muted-foreground">
          {title}
        </h3>
        {Icon && <Icon className={cn("h-5 w-5 shrink-0", iconStyles[variant])} />}
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>

        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center text-sm font-medium",
                  trend.value >= 0
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-rose-600 dark:text-rose-500"
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value}%
              </span>
            )}
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
