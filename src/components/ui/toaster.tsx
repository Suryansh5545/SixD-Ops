"use client";

import { useToast } from "@/hooks/use-toast";
import { X, CheckCircle, AlertCircle } from "lucide-react";

/**
 * Toast container — renders at bottom-right on desktop.
 * Mounted in the root layout via <Providers>.
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border shadow-lg p-4 animate-in slide-in-from-bottom-2 ${
            t.variant === "destructive"
              ? "bg-destructive text-destructive-foreground border-destructive/20"
              : "bg-card text-foreground border"
          }`}
        >
          {t.variant === "destructive" ? (
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-green-500" />
          )}
          <div className="flex-1 min-w-0">
            {t.title && <p className="font-semibold text-sm">{t.title}</p>}
            {t.description && <p className="text-xs mt-0.5 opacity-90">{t.description}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-70 hover:opacity-100 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
