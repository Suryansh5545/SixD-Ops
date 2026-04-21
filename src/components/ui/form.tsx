"use client";

import * as React from "react";
import {
  useFormContext,
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

// ─── FormField ───────────────────────────────────────────────────────────────

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return <Controller {...props} />;
}

// ─── FormItem ────────────────────────────────────────────────────────────────

const FormItemContext = React.createContext<{ id: string }>({ id: "" });

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  );
});
FormItem.displayName = "FormItem";

// ─── FormLabel ───────────────────────────────────────────────────────────────

const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  const { id } = React.useContext(FormItemContext);
  return (
    <Label
      ref={ref}
      htmlFor={id}
      className={cn("", className)}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

// ─── FormControl ─────────────────────────────────────────────────────────────

const FormControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ ...props }, ref) => {
  const { id } = React.useContext(FormItemContext);
  return (
    <div
      ref={ref}
      id={id}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

// ─── FormDescription ─────────────────────────────────────────────────────────

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { id } = React.useContext(FormItemContext);
  return (
    <p
      ref={ref}
      id={`${id}-description`}
      className={cn("text-[0.8rem] text-muted-foreground", className)}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

// ─── FormMessage ─────────────────────────────────────────────────────────────

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  // Try to get error from RHF context
  const { id } = React.useContext(FormItemContext);

  const body = children;
  if (!body) return null;

  return (
    <p
      ref={ref}
      id={`${id}-message`}
      className={cn("text-[0.8rem] font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

// ─── Form ────────────────────────────────────────────────────────────────────

function Form<TFieldValues extends FieldValues>({
  ...props
}: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} />;
}

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
};
