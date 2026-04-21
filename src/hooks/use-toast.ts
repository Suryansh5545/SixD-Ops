/**
 * Toast hook — minimal shadcn/ui-compatible implementation.
 * Wraps global toast state for use in any component.
 */

"use client";

import { useEffect, useState } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

// Simple global store (no Zustand needed for toasts)
let listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function dispatch(toast: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  const newToast = { ...toast, id };
  toasts = [...toasts, newToast];
  listeners.forEach((l) => l(toasts));

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    listeners.forEach((l) => l(toasts));
  }, toast.duration ?? 4000);
}

export function toast(opts: Omit<Toast, "id">) {
  dispatch(opts);
}

export function useToast() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>(toasts);

  useEffect(() => {
    const handler = (updated: Toast[]) => setCurrentToasts([...updated]);
    listeners.push(handler);

    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  return {
    toasts: currentToasts,
    toast: (opts: Omit<Toast, "id">) => dispatch(opts),
    dismiss: (id: string) => {
      toasts = toasts.filter((t) => t.id !== id);
      listeners.forEach((l) => l(toasts));
    },
  };
}
