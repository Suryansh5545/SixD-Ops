"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  poNumber: z.string().min(1, "PO number is required"),
  clientId: z.string().min(1, "Client is required"),
  scope: z.string().min(10, "Describe the scope (min 10 chars)"),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("INR"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  division: z.enum(["TS", "LSS"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const CLIENT_OPTIONS = [
  { id: "tata", name: "Tata Steel" },
  { id: "sail", name: "SAIL" },
  { id: "jsw", name: "JSW Steel" },
];

export default function NewPOPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: "INR",
      division: "TS",
    },
  });

  const amount = watch("amount");

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create PO");
      }

      const po = await res.json();
      toast({ title: "PO created", description: `PO ${po.poNumber} added successfully` });
      router.push(`/pos/${po.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/pos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Purchase Order</h1>
          <p className="text-sm text-muted-foreground">Register an incoming PO from a client</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PO Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="poNumber">PO Number *</Label>
                <Input
                  id="poNumber"
                  placeholder="e.g. TATA-2024-001"
                  {...register("poNumber")}
                />
                {errors.poNumber && (
                  <p className="text-xs text-destructive">{errors.poNumber.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client *</Label>
                <select
                  id="clientId"
                  className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register("clientId")}
                >
                  <option value="">Select client…</option>
                  {CLIENT_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="text-xs text-destructive">{errors.clientId.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scope">Scope of Work *</Label>
              <Textarea
                id="scope"
                rows={4}
                placeholder="Describe the work scope as stated in the PO…"
                {...register("scope")}
              />
              {errors.scope && (
                <p className="text-xs text-destructive">{errors.scope.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount">PO Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("amount")}
                />
                {amount && (
                  <p className="text-xs text-muted-foreground">
                    ₹{Number(amount).toLocaleString("en-IN")}
                  </p>
                )}
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="division">Division *</Label>
                <select
                  id="division"
                  className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register("division")}
                >
                  <option value="TS">TS (Technical Services)</option>
                  <option value="LSS">LS&amp;S (Lifting, Safety &amp; Survey)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register("startDate")}
                />
                {errors.startDate && (
                  <p className="text-xs text-destructive">{errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  {...register("endDate")}
                />
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any internal notes, special conditions, or flags…"
              rows={3}
              {...register("notes")}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/pos">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="brand" loading={submitting}>
            <Plus className="h-4 w-4" />
            Create PO
          </Button>
        </div>
      </form>
    </div>
  );
}
