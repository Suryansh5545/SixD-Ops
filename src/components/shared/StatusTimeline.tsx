"use client";

import { formatDate } from "@/lib/utils/date";
import type { AuditLogEntry } from "@/types";

interface StatusTimelineProps {
  logs: AuditLogEntry[];
}

/**
 * Displays an audit log as a vertical timeline.
 * Shows newest entries first.
 * Used on project, invoice, and compliance detail pages.
 */
export function StatusTimeline({ logs }: StatusTimelineProps) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
    );
  }

  return (
    <div className="space-y-0">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-4">
          {/* Timeline spine */}
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
            {i < logs.length - 1 && (
              <div className="w-px flex-1 bg-border min-h-[24px]" />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-snug">
              {log.description ?? log.action}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {log.performedBy.name} · {formatDate(log.timestamp, "dd MMM yyyy, hh:mm a")}
            </p>
            {log.oldValue && log.newValue && (
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="line-through opacity-60">{JSON.stringify(log.oldValue)}</span>
                {" → "}
                <span>{JSON.stringify(log.newValue)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
