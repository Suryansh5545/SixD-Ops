import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface PODayCounterProps {
  daysConsumed: number;
  daysAuthorised: number;
  className?: string;
}

/**
 * Visual progress counter for PO day quota.
 * Shows consumed / authorised with a colour-coded progress bar.
 * Turns amber at 80%, red at 100%.
 */
export function PODayCounter({ daysConsumed, daysAuthorised, className }: PODayCounterProps) {
  const percent = daysAuthorised > 0 ? Math.min(100, Math.round((daysConsumed / daysAuthorised) * 100)) : 0;

  const barColor =
    percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-green-500";

  const textColor =
    percent >= 100 ? "text-red-600" : percent >= 80 ? "text-amber-600" : "text-green-600";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">PO Day Quota</span>
        <div className="flex items-center gap-1">
          {percent >= 80 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          <span className={cn("font-bold", textColor)}>
            {daysConsumed} / {daysAuthorised} days ({percent}%)
          </span>
        </div>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= 100 && (
        <p className="text-xs text-red-600 font-medium">
          PO quota exhausted — request extension or initiate invoice
        </p>
      )}
      {percent >= 80 && percent < 100 && (
        <p className="text-xs text-amber-600 font-medium">
          Approaching quota limit — {daysAuthorised - daysConsumed} day(s) remaining
        </p>
      )}
    </div>
  );
}
