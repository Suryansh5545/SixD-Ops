"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectContextValue {
  disabled?: boolean;
  labels: Record<string, React.ReactNode>;
  open: boolean;
  registerItem: (value: string, label: React.ReactNode) => void;
  setOpen: (open: boolean) => void;
  setValue: (value: string) => void;
  unregisterItem: (value: string) => void;
  value: string;
}

const SelectContext = React.createContext<SelectContextValue>({
  labels: {},
  open: false,
  registerItem: () => {},
  setOpen: () => {},
  setValue: () => {},
  unregisterItem: () => {},
  value: "",
});

interface SelectProps {
  children: React.ReactNode;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  name?: string;
  onValueChange?: (value: string) => void;
  value?: string;
}

function Select({
  children,
  className,
  defaultValue = "",
  disabled,
  name,
  onValueChange,
  value: controlledValue,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({});
  const rootRef = React.useRef<HTMLDivElement>(null);

  const value = controlledValue ?? uncontrolledValue;

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const registerItem = React.useCallback((itemValue: string, label: React.ReactNode) => {
    setLabels((prev) => {
      if (prev[itemValue] === label) return prev;
      return { ...prev, [itemValue]: label };
    });
  }, []);

  const unregisterItem = React.useCallback((itemValue: string) => {
    setLabels((prev) => {
      if (!(itemValue in prev)) return prev;
      const next = { ...prev };
      delete next[itemValue];
      return next;
    });
  }, []);

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(nextValue);
      }

      onValueChange?.(nextValue);
      setOpen(false);
    },
    [controlledValue, onValueChange]
  );

  return (
    <SelectContext.Provider
      value={{
        disabled,
        labels,
        open,
        registerItem,
        setOpen,
        setValue,
        unregisterItem,
        value,
      }}
    >
      <div ref={rootRef} className={cn("relative", className)}>
        {name ? <input type="hidden" name={name} value={value} /> : null}
        {children}
      </div>
    </SelectContext.Provider>
  );
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { disabled, open, setOpen } = React.useContext(SelectContext);

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      disabled={disabled}
      onClick={() => setOpen(!open)}
      {...props}
    >
      <span className="truncate text-left">{children}</span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { labels, value } = React.useContext(SelectContext);
  const label = value ? labels[value] : null;

  return (
    <span className={cn("block truncate", !label && "text-muted-foreground")}>
      {label ?? placeholder ?? ""}
    </span>
  );
}

function SelectContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = React.useContext(SelectContext);

  return (
    <div
      className={cn(
        open
          ? "absolute top-full z-50 mt-1 max-h-96 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          : "hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function SelectItem({
  className,
  children,
  value,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { registerItem, setValue, unregisterItem, value: selectedValue } =
    React.useContext(SelectContext);
  const selected = selectedValue === value;

  React.useEffect(() => {
    registerItem(value, children);
    return () => unregisterItem(value);
  }, [children, registerItem, unregisterItem, value]);

  return (
    <div
      role="option"
      aria-selected={selected}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={() => setValue(value)}
      {...props}
    >
      <Check className={cn("absolute right-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
      <span className={cn("truncate", selected && "font-medium")}>{children}</span>
    </div>
  );
}

function SelectLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("py-1.5 pl-2 pr-2 text-xs font-semibold", className)} {...props} />;
}

function SelectSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
};
