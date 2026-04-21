"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Download, Send, CheckCircle, CreditCard, Copy, MessageSquare } from "lucide-react";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/utils/currency";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedAt?: string;
  dueDate?: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    type: string;
  }>;
  project: {
    id: string;
    projectId: string;
    title: string;
    po: { poNumber: string; client: { name: string; gstPercent: number } };
  };
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMode: string;
    referenceNumber?: string;
    notes?: string;
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

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "muted" | "destructive"> = {
  DRAFT: "muted",
  UNDER_REVIEW: "warning",
  APPROVED: "info",
  SENT: "brand" as never,
  PARTIALLY_PAID: "warning",
  PAID: "success",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMode, setPaymentMode] = useState("NEFT");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: invoice, isLoading } = useQuery<InvoiceDetail>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const advanceStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: "Invoice status updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          paymentDate,
          paymentMode,
          referenceNumber: paymentRef || undefined,
          notes: paymentNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: "Payment recorded" });
      setPaymentDialog(false);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyWhatsApp = () => {
    if (!invoice) return;
    const balance = invoice.totalAmount - invoice.paidAmount;
    const msg = `Dear ${invoice.project.po.client.name} Team,\n\nPlease find invoice ${invoice.invoiceNumber} for project ${invoice.project.projectId} — ${invoice.project.title}.\n\nTotal: ${formatINR(invoice.totalAmount)}\nPaid: ${formatINR(invoice.paidAmount)}\nBalance Due: ${formatINR(balance)}\nDue Date: ${invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "As agreed"}\n\nKindly arrange payment at the earliest.\n\nRegards,\nSixD Engineering Solutions`;
    navigator.clipboard.writeText(msg);
    toast({ title: "WhatsApp message copied", description: "Paste in WhatsApp to send" });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Link href="/invoices"><Button variant="outline">Back to Invoices</Button></Link>
      </div>
    );
  }

  const balance = invoice.totalAmount - invoice.paidAmount;
  const nextActions = STATUS_ACTIONS[invoice.status] ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono">{invoice.invoiceNumber}</h1>
              <Badge variant={STATUS_VARIANT[invoice.status] ?? "muted"}>
                {invoice.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {invoice.project.po.client.name} · {invoice.project.projectId}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyWhatsApp}
          >
            <MessageSquare className="h-4 w-4" />
            WhatsApp
          </Button>
          <a href={`/api/invoices/${id}/pdf`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </a>
          {can("payment:record") && balance > 0 && ["SENT", "PARTIALLY_PAID"].includes(invoice.status) && (
            <Button variant="brand" size="sm" onClick={() => setPaymentDialog(true)}>
              <CreditCard className="h-4 w-4" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Status Actions */}
      {nextActions.length > 0 && (
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
      )}

      {/* Summary */}
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
            <p className="text-lg font-bold text-green-600">{formatINR(invoice.paidAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Balance Due</p>
            <p className={`text-lg font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatINR(balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dates */}
      {(invoice.issuedAt || invoice.dueDate) && (
        <Card>
          <CardContent className="pt-4 flex gap-8 text-sm">
            {invoice.issuedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Issue Date</p>
                <p className="font-medium">{format(new Date(invoice.issuedAt), "dd MMM yyyy")}</p>
              </div>
            )}
            {invoice.dueDate && (
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="font-medium">{format(new Date(invoice.dueDate), "dd MMM yyyy")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoice.lineItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} × {formatINR(item.unitPrice)}
                  </p>
                </div>
                <p className="font-medium text-sm">{formatINR(item.amount)}</p>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatINR(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                GST ({invoice.project.po.client.gstPercent}%)
              </span>
              <span>{formatINR(invoice.gstAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>{formatINR(invoice.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoice.payments.map((pmt) => (
              <div key={pmt.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{formatINR(pmt.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(pmt.paymentDate), "dd MMM yyyy")} · {pmt.paymentMode}
                    {pmt.referenceNumber ? ` · Ref: ${pmt.referenceNumber}` : ""}
                  </p>
                  {pmt.notes && <p className="text-xs text-muted-foreground">{pmt.notes}</p>}
                </div>
                <Badge variant="success">Received</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={`Max: ${balance.toFixed(2)}`}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <select
                className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="IMPS">IMPS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Input
                placeholder="UTR / Cheque No."
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                placeholder="Optional notes…"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>Cancel</Button>
            <Button
              variant="brand"
              loading={recordPayment.isPending}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
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
