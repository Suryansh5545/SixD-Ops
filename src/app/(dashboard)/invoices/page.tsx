"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { formatINR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { INVOICE_STATUS_LABELS } from "@/types";
import type { InvoiceStatus } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  APPROVED: "bg-indigo-100 text-indigo-700",
  SENT: "bg-brand-100 text-brand-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700",
};

export default function InvoicesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", { search, status, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/invoices?${params}`);
      const json = await res.json();
      return json.data;
    },
    placeholderData: (prev) => prev,
  });

  const invoices = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleBulkTallyExport = async () => {
    if (selectedIds.length === 0) {
      toast({ title: "Select invoices to export", variant: "destructive" });
      return;
    }
    const res = await fetch("/api/invoices/tally-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    if (!res.ok) {
      toast({ title: "Export failed", variant: "destructive" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Tally_Export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <Button variant="outline" onClick={handleBulkTallyExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export to Tally
          {selectedIds.length > 0 && <Badge>{selectedIds.length}</Badge>}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice number, client, project..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv: { id: string; invoiceNumber: string; status: InvoiceStatus; project: { name: string; client: { name: string } }; invoiceDate: string; totalAmount: string; balanceDue: string; dueDate: string | null }) => (
            <div
              key={inv.id}
              className="rounded-xl border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  checked={selectedIds.includes(inv.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds((prev) => [...prev, inv.id]);
                    else setSelectedIds((prev) => prev.filter((id) => id !== inv.id));
                  }}
                />
                <Link href={`/invoices/${inv.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm font-mono">{inv.invoiceNumber}</span>
                        <Badge className={`text-xs ${STATUS_BADGE[inv.status]}`}>
                          {INVOICE_STATUS_LABELS[inv.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {inv.project.client.name} · {inv.project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(inv.invoiceDate)}
                        {inv.dueDate && ` · Due: ${formatDate(inv.dueDate)}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{formatINR(inv.totalAmount, 0)}</p>
                      {parseFloat(inv.balanceDue) > 0 && (
                        <p className="text-xs text-amber-600">
                          Balance: {formatINR(inv.balanceDue, 0)}
                        </p>
                      )}
                      {parseFloat(inv.balanceDue) === 0 && inv.status === "PAID" && (
                        <p className="text-xs text-green-600">Fully paid</p>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
