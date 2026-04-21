"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addDays, format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  Download,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatINR, toNumber } from "@/lib/utils/currency";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceDate: string;
  dueDate?: string | null;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  balanceDue: number;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  project: {
    id: string;
    name: string;
    client: { name: string; gstPercent: number };
  };
  po: {
    internalId: string;
    referenceNumber: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    referenceNumber?: string | null;
    notes?: string | null;
    recordedBy?: { name: string } | null;
  }>;
}

const STATUS_ACTIONS: Record<string, { label: string; next: string; variant: "brand" | "outline" }[]> = {
  DRAFT: [{ label: "Mark Under Review", next: "UNDER_REVIEW", variant: "brand" }],
  UNDER_REVIEW: [{ label: "Approve Invoice", next: "APPROVED", variant: "brand" }],
  APPROVED: [{ label: "Mark Sent to Client", next: "SENT", variant: "brand" }],
  SENT: [],
  PARTIALLY_PAID: [],
  PAID: [],
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "muted" | "brand"> = {
  DRAFT: "muted",
  UNDER_REVIEW: "warning",
  APPROVED: "info",
  SENT: "brand",
  PARTIALLY_PAID: "warning",
  PAID: "success",
};

function normalizeInvoice(raw: any): InvoiceDetail {
  const totalAmount = toNumber(raw?.totalAmount);
  const balanceDue = toNumber(raw?.balanceDue);
  const lineItems = Array.isArray(raw?.lineItems) ? raw.lineItems : [];
  const payments = Array.isArray(raw?.payments) ? raw.payments : [];

  return {
    id: raw.id,
    invoiceNumber: raw.invoiceNumber,
    status: raw.status,
    invoiceDate: raw.invoiceDate,
    dueDate: raw.dueDate ?? null,
    subtotal: toNumber(raw.subtotal),
    gstAmount: toNumber(raw.gstAmount),
    totalAmount,
    balanceDue,
    lineItems: lineItems.map((item: any, index: number) => ({
      id: item.id ?? `${index}`,
      description: item.description ?? "Line item",
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.rate ?? item.unitPrice ?? 0),
      amount: Number(item.amount ?? 0),
    })),
    project: {
      id: raw.project?.id,
      name: raw.project?.name ?? "Untitled Project",
      client: {
        name: raw.project?.client?.name ?? raw.po?.client?.name ?? "Unknown Client",
        gstPercent: Number(raw.project?.client?.gstPercent ?? 0),
      },
    },
    po: {
      internalId: raw.po?.internalId ?? "-",
      referenceNumber: raw.po?.referenceNumber ?? "-",
    },
    payments: payments.map((payment: any) => ({
      id: payment.id,
      amount: toNumber(payment.amount),
      paymentDate: payment.paymentDate,
      referenceNumber: payment.referenceNumber ?? null,
      notes: payment.notes ?? null,
      recordedBy: payment.recordedBy ?? null,
    })),
  };
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: invoice, isLoading, isError } = useQuery<InvoiceDetail | null>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data) return null;
      return normalizeInvoice(json.data);
    },
  });

  const advanceStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update invoice status");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: "Invoice status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          paymentDate,
          referenceNumber: paymentRef || undefined,
          notes: paymentNotes || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to record payment");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: "Payment recorded" });
      setPaymentDialog(false);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyWhatsApp = () => {
    if (!invoice) return;

    const msg = `Dear ${invoice.project.client.name} Team,\n\nPlease find invoice ${invoice.invoiceNumber} for project ${invoice.project.name}.\n\nPO: ${invoice.po.internalId}\nTotal: ${formatINR(invoice.totalAmount)}\nBalance Due: ${formatINR(invoice.balanceDue)}\nDue Date: ${invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "As agreed"}\n\nKindly arrange payment at the earliest.\n\nRegards,\nSixD Engineering Solutions`;

    navigator.clipboard.writeText(msg);
    toast({ title: "WhatsApp message copied", description: "Paste it into WhatsApp to send." });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground">Invoice data is unavailable right now.</p>
        <Link href="/invoices">
          <Button variant="outline">Back to Invoices</Button>
        </Link>
      </div>
    );
  }

  const paidAmount = Math.max(0, invoice.totalAmount - invoice.balanceDue);
  const nextActions = STATUS_ACTIONS[invoice.status] ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-bold">{invoice.invoiceNumber}</h1>
              <Badge variant={STATUS_VARIANT[invoice.status] ?? "muted"}>
                {invoice.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {invoice.project.client.name} - {invoice.project.name}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyWhatsApp}>
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </Button>
          <a href={`/api/invoices/${id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </a>
          {can("payment:record") &&
            invoice.balanceDue > 0 &&
            ["SENT", "PARTIALLY_PAID"].includes(invoice.status) && (
              <Button variant="brand" size="sm" onClick={() => setPaymentDialog(true)}>
                <CreditCard className="h-4 w-4" />
                Record Payment
              </Button>
            )}
        </div>
      </div>

      {nextActions.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-4">
          {nextActions.map((action) => (
            <Button
              key={action.next}
              variant={action.variant}
              size="sm"
              loading={advanceStatus.isPending}
              onClick={() => advanceStatus.mutate(action.next)}
            >
              <CheckCircle className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{formatINR(invoice.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-green-600">{formatINR(paidAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Balance Due</p>
            <p className={`text-lg font-bold ${invoice.balanceDue > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatINR(invoice.balanceDue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex gap-8 pt-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Invoice Date</p>
            <p className="font-medium">{format(new Date(invoice.invoiceDate), "dd MMM yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="font-medium">
              {invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : format(addDays(new Date(invoice.invoiceDate), 30), "dd MMM yyyy")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">PO Reference</p>
            <p className="font-medium">{invoice.po.internalId}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items available.</p>
          ) : (
            <div className="space-y-3">
              {invoice.lineItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} x {formatINR(item.unitPrice)}
                    </p>
                  </div>
                  <p className="text-sm font-medium">{formatINR(item.amount)}</p>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-4" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST ({invoice.project.client.gstPercent}%)</span>
              <span>{formatINR(invoice.gstAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatINR(invoice.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments have been recorded yet.</p>
          ) : (
            invoice.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{formatINR(payment.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(payment.paymentDate), "dd MMM yyyy")}
                    {payment.referenceNumber ? ` - Ref: ${payment.referenceNumber}` : ""}
                  </p>
                  {payment.recordedBy?.name ? (
                    <p className="text-xs text-muted-foreground">Recorded by {payment.recordedBy.name}</p>
                  ) : null}
                  {payment.notes ? <p className="text-xs text-muted-foreground">{payment.notes}</p> : null}
                </div>
                <Badge variant="success">Received</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount (INR) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={`Max: ${invoice.balanceDue.toFixed(2)}`}
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date *</Label>
              <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Input
                placeholder="UTR / Cheque No."
                value={paymentRef}
                onChange={(event) => setPaymentRef(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                placeholder="Optional notes..."
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              loading={recordPayment.isPending}
              disabled={
                !paymentAmount ||
                parseFloat(paymentAmount) <= 0 ||
                parseFloat(paymentAmount) > invoice.balanceDue
              }
              onClick={() => recordPayment.mutate()}
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
