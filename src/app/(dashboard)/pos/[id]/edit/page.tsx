"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { composePONotes, parsePONotes } from "@/lib/po-notes";

const schema = z.object({
  referenceNumber: z.string().min(1, "PO number is required"),
  clientId: z.string().min(1, "Client is required"),
  scope: z.string().min(10, "Describe the scope (min 10 chars)"),
  amount: z.coerce.number().positive("Amount must be positive"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "Expiry date is required"),
  expectedWorkingDays: z.coerce.number().int().positive("Working days must be positive"),
  assignedPMId: z.string().min(1, "Business manager is required"),
  paymentTerms: z.enum(["NET_30", "NET_45", "CUSTOM"]).default("NET_30"),
  customPaymentDays: z.coerce.number().int().positive().optional(),
  division: z.enum(["TS", "LSS"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ClientOption {
  id: string;
  name: string;
  paymentTermsDefault: "NET_30" | "NET_45" | "CUSTOM";
}

interface UserOption {
  id: string;
  name: string;
}

interface PODetail {
  id: string;
  internalId: string;
  referenceNumber: string;
  amount: number | string;
  expiryDate: string;
  workStartDate?: string | null;
  expectedWorkingDays: number;
  paymentTerms: "NET_30" | "NET_45" | "CUSTOM";
  customPaymentDays?: number | null;
  notes?: string | null;
  clientId: string;
  assignedPMId: string;
}

const selectClasses =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function EditPOPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json().catch(() => null);
      return Array.isArray(json?.data) ? (json.data as ClientOption[]) : [];
    },
  });

  const { data: managers = [] } = useQuery<UserOption[]>({
    queryKey: ["business-managers"],
    queryFn: async () => {
      const res = await fetch("/api/users?role=BUSINESS_MANAGER", { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json().catch(() => null);
      return Array.isArray(json?.data) ? (json.data as UserOption[]) : [];
    },
  });

  const { data: po, isLoading, isError } = useQuery<PODetail | null>({
    queryKey: ["po-edit", id],
    queryFn: async () => {
      const res = await fetch(`/api/pos/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data) return null;
      return json.data as PODetail;
    },
  });

  const noteDetails = useMemo(() => parsePONotes(po?.notes), [po?.notes]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: po
      ? {
          referenceNumber: po.referenceNumber,
          clientId: po.clientId,
          scope: noteDetails.scope || "Existing scope details were not available.",
          amount: Number(po.amount),
          startDate: po.workStartDate?.slice(0, 10) ?? "",
          endDate: po.expiryDate.slice(0, 10),
          expectedWorkingDays: po.expectedWorkingDays,
          assignedPMId: po.assignedPMId,
          paymentTerms: po.paymentTerms,
          customPaymentDays: po.customPaymentDays ?? undefined,
          division: noteDetails.division ?? "TS",
          notes: noteDetails.additionalNotes,
        }
      : undefined,
  });

  const paymentTerms = watch("paymentTerms");

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);

    try {
      const res = await fetch(`/api/pos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: values.clientId,
          referenceNumber: values.referenceNumber,
          amount: values.amount,
          expiryDate: values.endDate,
          expectedWorkingDays: values.expectedWorkingDays,
          paymentTerms: values.paymentTerms,
          customPaymentDays: values.paymentTerms === "CUSTOM" ? values.customPaymentDays : null,
          assignedPMId: values.assignedPMId,
          workStartDate: values.startDate,
          notes: composePONotes({
            division: values.division,
            scope: values.scope,
            additionalNotes: values.notes,
          }),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update PO");
      }

      toast({ title: "PO updated" });
      router.push(`/pos/${id}`);
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update PO",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[34rem] w-full" />
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground">PO details are unavailable right now.</p>
        <Button asChild variant="outline">
          <Link href="/pos">Back to Purchase Orders</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/pos/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Purchase Order</h1>
          <p className="text-sm text-muted-foreground">{po.internalId}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PO Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="referenceNumber">PO Number</Label>
              <Input id="referenceNumber" {...register("referenceNumber")} />
              {errors.referenceNumber ? (
                <p className="text-xs text-destructive">{errors.referenceNumber.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientId">Client</Label>
              <select id="clientId" className={selectClasses} {...register("clientId")}>
                <option value="">Select client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              {errors.clientId ? <p className="text-xs text-destructive">{errors.clientId.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="division">Division</Label>
              <select id="division" className={selectClasses} {...register("division")}>
                <option value="TS">TS</option>
                <option value="LSS">LS&S</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="assignedPMId">Assigned Business Manager</Label>
              <select id="assignedPMId" className={selectClasses} {...register("assignedPMId")}>
                <option value="">Select business manager...</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
              {errors.assignedPMId ? (
                <p className="text-xs text-destructive">{errors.assignedPMId.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="scope">Scope of Work</Label>
              <Textarea id="scope" rows={4} {...register("scope")} />
              {errors.scope ? <p className="text-xs text-destructive">{errors.scope.message}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commercial and Timeline</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount ? <p className="text-xs text-destructive">{errors.amount.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expectedWorkingDays">Expected Working Days</Label>
              <Input id="expectedWorkingDays" type="number" min={1} {...register("expectedWorkingDays")} />
              {errors.expectedWorkingDays ? (
                <p className="text-xs text-destructive">{errors.expectedWorkingDays.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="startDate">Work Start Date</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate ? <p className="text-xs text-destructive">{errors.startDate.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endDate">PO Expiry Date</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
              {errors.endDate ? <p className="text-xs text-destructive">{errors.endDate.message}</p> : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <select id="paymentTerms" className={selectClasses} {...register("paymentTerms")}>
                <option value="NET_30">NET 30</option>
                <option value="NET_45">NET 45</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            {paymentTerms === "CUSTOM" ? (
              <div className="space-y-1.5">
                <Label htmlFor="customPaymentDays">Custom Payment Days</Label>
                <Input id="customPaymentDays" type="number" min={1} {...register("customPaymentDays")} />
                {errors.customPaymentDays ? (
                  <p className="text-xs text-destructive">{errors.customPaymentDays.message}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea id="notes" rows={3} {...register("notes")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button asChild variant="outline" type="button">
            <Link href={`/pos/${id}`}>Cancel</Link>
          </Button>
          <Button type="submit" variant="brand" loading={submitting}>
            <Save className="h-4 w-4" />
            Save PO
          </Button>
        </div>
      </form>
    </div>
  );
}
