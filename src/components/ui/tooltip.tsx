"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

function Tooltip({ children, content, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);

  const sideStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1",
    left: "right-full top-1/2 -translate-y-1/2 mr-1",
    right: "left-full top-1/2 -translate-y-1/2 ml-1",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={cn(
            "absolute z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 whitespace-nowrap pointer-events-none",
            sideStyles[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

// Shadcn-compatible aliases
function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
function TooltipTrigger({ children }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}
function TooltipContent({ children, className }: { children: React.ReactNode; className?: string; side?: string; sideOffset?: number }) {
  return (
    <div className={cn("z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground", className)}>
      {children}
    </div>
  );
}

export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent };
