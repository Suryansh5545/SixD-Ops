"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { composePONotes } from "@/lib/po-notes";

const schema = z.object({
  poNumber: z.string().min(1, "PO number is required"),
  clientId: z.string().min(1, "Client is required"),
  scope: z.string().min(10, "Describe the scope (min 10 chars)"),
  amount: z.coerce.number().positive("Amount must be positive"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
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
  email: string;
}

export default function NewPOPage() {
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

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      division: "TS",
      paymentTerms: "NET_30",
      expectedWorkingDays: 30,
    },
  });

  const clientId = watch("clientId");
  const amount = watch("amount");
  const paymentTerms = watch("paymentTerms");

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId),
    [clientId, clients]
  );

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: values.clientId,
          documentType: "PURCHASE_ORDER",
          referenceNumber: values.poNumber,
          amount: values.amount,
          expiryDate: values.endDate,
          expectedWorkingDays: values.expectedWorkingDays,
          paymentTerms: values.paymentTerms,
          customPaymentDays: values.paymentTerms === "CUSTOM" ? values.customPaymentDays : null,
          invoiceType: "SINGLE",
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
      if (!res.ok || !json?.success || !json?.data) {
        throw new Error(json?.error || "Failed to create PO");
      }

      toast({
        title: "PO created",
        description: `${json.data.internalId} added successfully.`,
      });
      router.push("/pos");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PO Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="poNumber">PO Number *</Label>
                <Input id="poNumber" placeholder="e.g. TATA-2024-001" {...register("poNumber")} />
                {errors.poNumber && <p className="text-xs text-destructive">{errors.poNumber.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clientId">Client *</Label>
                <select
                  id="clientId"
                  className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register("clientId", {
                    onChange: (event) => {
                      const client = clients.find((item) => item.id === event.target.value);
                      if (client) {
                        setValue("paymentTerms", client.paymentTermsDefault);
                      }
                    },
                  })}
                >
                  <option value="">Select client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scope">Scope of Work *</Label>
              <Textarea
                id="scope"
                rows={4}
                placeholder="Describe the work scope as stated in the PO..."
                {...register("scope")}
              />
              {errors.scope && <p className="text-xs text-destructive">{errors.scope.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount">PO Amount (INR) *</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0.00" {...register("amount")} />
                {amount ? (
                  <p className="text-xs text-muted-foreground">{Number(amount).toLocaleString("en-IN")}</p>
                ) : null}
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="division">Division *</Label>
                <select
                  id="division"
                  className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register("division")}
                >
                  <option value="TS">TS (Technical Services)</option>
                  <option value="LSS">LS&S</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="expectedWorkingDays">Expected Working Days *</Label>
                <Input id="expectedWorkingDays" type="number" min={1} {...register("expectedWorkingDays")} />
                {errors.expectedWorkingDays && (
                  <p className="text-xs text-destructive">{errors.expectedWorkingDays.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignedPMId">Assigned Business Manager *</Label>
                <select
                  id="assignedPMId"
                  className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register("assignedPMId")}
                >
                  <option value="">Select business manager...</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name}
                    </option>
                  ))}
                </select>
                {errors.assignedPMId && (
                  <p className="text-xs text-destructive">{errors.assignedPMId.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="paymentTerms">Payment Terms *</Label>
                <select
                  id="paymentTerms"
                  className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register("paymentTerms")}
                >
                  <option value="NET_30">NET 30</option>
                  <option value="NET_45">NET 45</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>

              {paymentTerms === "CUSTOM" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="customPaymentDays">Custom Payment Days *</Label>
                  <Input id="customPaymentDays" type="number" min={1} {...register("customPaymentDays")} />
                  {errors.customPaymentDays && (
                    <p className="text-xs text-destructive">{errors.customPaymentDays.message}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Client Default</Label>
                  <div className="flex h-9 items-center rounded-lg border border-input px-3 text-sm text-muted-foreground">
                    {selectedClient?.paymentTermsDefault?.replace("_", " ") ?? "Select a client"}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Work Start Date *</Label>
                <Input id="startDate" type="date" {...register("startDate")} />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">PO Expiry Date *</Label>
                <Input id="endDate" type="date" {...register("endDate")} />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any internal notes, special conditions, or flags..."
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
