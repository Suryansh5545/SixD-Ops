"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatINR } from "@/lib/utils/currency";
import { formatDate, daysUntilExpiry } from "@/lib/utils/date";

export default function POsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["pos", { search, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/pos?${params}`);
      const json = await res.json();
      return json.data;
    },
    placeholderData: (prev) => prev,
  });

  const pos = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <RoleGuard permission="po:create">
          <Button asChild className="bg-brand-500 hover:bg-brand-600">
            <Link href="/pos/new">
              <Plus className="h-4 w-4 mr-2" />
              New PO
            </Link>
          </Button>
        </RoleGuard>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by PO number, client..."
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : pos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium mb-1">No purchase orders found</p>
          <RoleGuard permission="po:create">
            <Button asChild className="mt-4 bg-brand-500 hover:bg-brand-600">
              <Link href="/pos/new">Create your first PO</Link>
            </Button>
          </RoleGuard>
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po: {
            id: string;
            internalId: string;
            client: { name: string };
            documentType: string;
            referenceNumber: string;
            amount: string;
            remainingValue: string;
            expiryDate: string;
            assignedPM: { name: string };
            invoiceType: string;
            paymentTerms: string;
          }) => {
            const days = daysUntilExpiry(po.expiryDate);
            const isExpiringSoon = days <= 30 && days > 0;
            const isExpired = days < 0;

            return (
              <Link
                key={po.id}
                href={`/pos/${po.id}`}
                className="block rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm font-mono">{po.internalId}</span>
                      <Badge variant="secondary" className="text-xs">
                        {po.documentType.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {po.invoiceType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {po.client.name} · Ref: {po.referenceNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Business Manager: {po.assignedPM.name} · {po.paymentTerms.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-bold text-sm">{formatINR(po.amount, 0)}</p>
                    <p className="text-xs text-green-600">
                      Rem: {formatINR(po.remainingValue, 0)}
                    </p>
                    <div>
                      {isExpired && (
                        <Badge variant="destructive" className="text-xs">
                          EXPIRED
                        </Badge>
                      )}
                      {isExpiringSoon && !isExpired && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                          {days}d left
                        </Badge>
                      )}
                      {!isExpiringSoon && !isExpired && (
                        <span className="text-xs text-muted-foreground">{formatDate(po.expiryDate)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
