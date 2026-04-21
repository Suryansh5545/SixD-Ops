import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderMetaItem {
  label: string;
  value: string;
}

interface DashboardHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  badge?: string;
  meta?: DashboardHeaderMetaItem[];
  actions?: ReactNode;
  className?: string;
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  badge,
  meta = [],
  actions,
  className,
}: DashboardHeaderProps) {
  return (
    <section className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2.5">
          {(eyebrow || badge) && (
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow && (
                <span className="text-xs font-medium tracking-tight text-muted-foreground">
                  {eyebrow}
                </span>
              )}
              {badge && (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground ring-1 ring-inset ring-border/50">
                  {badge}
                </span>
              )}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {meta.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {meta.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
