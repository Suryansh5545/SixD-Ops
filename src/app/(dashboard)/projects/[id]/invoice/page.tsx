"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, AlertTriangle, Receipt, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/utils/currency";
import { toast } from "@/hooks/use-toast";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: string;
}

interface InvoiceInitData {
  projectId: string;
  project: {
    title: string;
    projectId: string;
    dailyRate: number;
    daysConsumed: number;
    extraHours: number;
    standbyHoursTotal: number;
    gstPercent: number;
    po: { poNumber: string; client: { name: string } };
  };
  lineItems: LineItem[];
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  complianceGate: { passed: boolean; missing: string[] };
  suggestedPaymentTerms: number;
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery<InvoiceInitData>({
    queryKey: ["invoice-init", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/invoice`);
      if (res.status === 422) {
        const body = await res.json();
        return body; // contains complianceGate.missing
      }
      if (!res.ok) throw new Error("Failed to load invoice data");
      return res.json();
    },
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  // One-time initialize from server data
  if (data && !initialized) {
    setLineItems(data.lineItems ?? []);
    setPaymentTerms(data.suggestedPaymentTerms ?? 30);
    setInitialized(true);
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const gstPercent = data?.project.gstPercent ?? 18;
  const gstAmount = subtotal * (gstPercent / 100);
  const totalAmount = subtotal + gstAmount;

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => {
      const items = [...prev];
      items[index] = { ...items[index], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        items[index].amount = items[index].quantity * items[index].unitPrice;
      }
      return items;
    });
  };

  const addItem = () => {
    setLineItems((prev) => [...prev, {
      description: "",
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      type: "CUSTOM",
    }]);
  };

  const removeItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems, paymentTerms, notes }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate invoice");
      }
      return res.json();
    },
    onSuccess: (invoice) => {
      toast({ title: "Invoice created", description: `${invoice.invoiceNumber} generated` });
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const blocked = data?.complianceGate && !data.complianceGate.passed;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Generate Invoice</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.project.projectId} · {data.project.po.client.name}
            </p>
          )}
        </div>
      </div>

      {/* Compliance gate */}
      {blocked && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Compliance gate blocked.</strong> Upload these mandatory documents before invoicing:
            <ul className="mt-1 list-disc pl-4 text-sm">
              {data?.complianceGate.missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
            <Link href={`/projects/${id}/documents`}>
              <Button size="sm" variant="outline" className="mt-2">Go to Documents</Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Project Summary */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Daily Rate</p>
              <p className="font-medium">{formatINR(data.project.dailyRate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Days Consumed</p>
              <p className="font-medium">{data.project.daysConsumed}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Extra Hours</p>
              <p className="font-medium">{data.project.extraHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Standby Hours</p>
              <p className="font-medium">{data.project.standbyHoursTotal.toFixed(1)}h</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button size="sm" variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No line items. Click "Add Row" to start.</p>
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                <span className="col-span-5">Description</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-2">Unit Price</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-1"></span>
              </div>
              <Separator />

              {lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      placeholder="Description…"
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.5"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium">
                    {formatINR(item.amount)}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      onClick={() => removeItem(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST ({gstPercent}%)</span>
            <span>{formatINR(gstAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total Amount</span>
            <span className="text-lg">{formatINR(totalAmount)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Payment Due (days)</Label>
            <Input
              type="number"
              min={1}
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(parseInt(e.target.value) || 30)}
              className="w-32"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes for Invoice</Label>
            <Input
              placeholder="e.g. Kindly release payment within due date…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link href={`/projects/${id}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          variant="brand"
          size="lg"
          loading={generate.isPending}
          disabled={blocked || lineItems.length === 0}
          onClick={() => generate.mutate()}
        >
          <Receipt className="h-4 w-4" />
          Generate Invoice
        </Button>
      </div>
    </div>
  );
}
