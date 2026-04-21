"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Search, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

interface PaymentsDashboardData {
  recentPayments: Array<{
    id: string;
    amount: number | string;
    paymentDate: string;
    referenceNumber?: string | null;
    invoice: {
      id: string;
      invoiceNumber: string;
      project: {
        id: string;
        name: string;
        client: { name: string };
      };
    };
    recordedBy?: { name: string } | null;
  }>;
  outstandingInvoices: Array<{
    id: string;
    invoiceNumber: string;
    dueDate?: string | null;
    invoiceDate: string;
    totalAmount: number | string;
    balanceDue: number | string;
    status: string;
    project: {
      id: string;
      name: string;
      client: { name: string };
    };
  }>;
  summary: {
    overdueInvoices: number;
    outstandingInvoices: number;
    receivedThisMonth: number;
    totalOutstanding: number;
  };
}

export default function PaymentsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<PaymentsDashboardData | null>({
    queryKey: ["payments-dashboard", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/payments${params.toString() ? `?${params}` : ""}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data) return null;
      return json.data as PaymentsDashboardData;
    },
  });

  const summary = data?.summary ?? {
    overdueInvoices: 0,
    outstandingInvoices: 0,
    receivedThisMonth: 0,
    totalOutstanding: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Track outstanding collections and recently recorded receipts.
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search invoice, client, project, reference..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 w-full" />)
        ) : (
          <>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Outstanding Amount</p>
                <p className="text-xl font-bold">{formatINR(summary.totalOutstanding)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Outstanding Invoices</p>
                <p className="text-xl font-bold">{summary.outstandingInvoices}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Overdue Invoices</p>
                <p className="text-xl font-bold text-amber-600">{summary.overdueInvoices}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Received This Month</p>
                <p className="text-xl font-bold text-green-600">{formatINR(summary.receivedThisMonth)}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Outstanding Collections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full" />)
            ) : isError || !data ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Payment data is unavailable right now. The page will recover automatically once the backend responds.
                </p>
              </div>
            ) : data.outstandingInvoices.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No outstanding invoices matched your search.
              </div>
            ) : (
              data.outstandingInvoices.map((invoice) => {
                const isOverdue = !!invoice.dueDate && new Date(invoice.dueDate) < new Date();

                return (
                  <div
                    key={invoice.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <Badge variant={isOverdue ? "warning" : "outline"}>
                          {isOverdue ? "Overdue" : invoice.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.project.client.name} · {invoice.project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Invoice Date: {formatDate(invoice.invoiceDate)}
                        {invoice.dueDate ? ` · Due: ${formatDate(invoice.dueDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatINR(invoice.balanceDue)}</p>
                        <p className="text-xs text-muted-foreground">
                          Total {formatINR(invoice.totalAmount)}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/invoices/${invoice.id}`}>
                          Open
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              [1, 2, 3].map((item) => <Skeleton key={item} className="h-20 w-full" />)
            ) : isError || !data ? (
              <p className="text-sm text-muted-foreground">
                Recent payment activity could not be loaded right now.
              </p>
            ) : data.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments have been recorded yet.</p>
            ) : (
              data.recentPayments.map((payment) => (
                <div key={payment.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{payment.invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.invoice.project.client.name} · {payment.invoice.project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.paymentDate)}
                        {payment.referenceNumber ? ` · Ref: ${payment.referenceNumber}` : ""}
                      </p>
                      {payment.recordedBy?.name ? (
                        <p className="text-xs text-muted-foreground">Recorded by {payment.recordedBy.name}</p>
                      ) : null}
                    </div>
                    <p className="text-sm font-semibold text-green-600">{formatINR(payment.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
