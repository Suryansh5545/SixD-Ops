"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FilePenLine,
  FileText,
  Plus,
  Receipt,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, toNumber } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { parsePONotes } from "@/lib/po-notes";
import { useAuth } from "@/hooks/useAuth";

interface PODetail {
  id: string;
  internalId: string;
  referenceNumber: string;
  documentType: string;
  amount: number | string;
  remainingValue: number | string;
  expiryDate: string;
  workStartDate?: string | null;
  expectedWorkingDays: number;
  paymentTerms: string;
  customPaymentDays?: number | null;
  invoiceType: string;
  notes?: string | null;
  createdAt: string;
  client: { name: string };
  assignedPM?: { name: string; email: string } | null;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    daysConsumed: number;
    daysAuthorised: number;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    totalAmount: number | string;
    status: string;
    invoiceDate: string;
  }>;
}

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();

  const { data: po, isLoading, isError } = useQuery<PODetail | null>({
    queryKey: ["po", id],
    queryFn: async () => {
      const res = await fetch(`/api/pos/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data) return null;
      return json.data as PODetail;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
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

  const amount = toNumber(po.amount);
  const remainingValue = toNumber(po.remainingValue);
  const utilizedValue = Math.max(0, amount - remainingValue);
  const utilizationPct = amount > 0 ? Math.round((utilizedValue / amount) * 100) : 0;
  const details = parsePONotes(po.notes);
  const paymentTermsLabel =
    po.paymentTerms === "CUSTOM" && po.customPaymentDays
      ? `Custom (${po.customPaymentDays} days)`
      : po.paymentTerms.replace(/_/g, " ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{po.internalId}</h1>
              <Badge variant="outline">{po.documentType.replace(/_/g, " ")}</Badge>
              <Badge variant="secondary">{po.invoiceType}</Badge>
              {details.division ? <Badge variant="muted">{details.division}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {po.client.name} · Ref: {po.referenceNumber}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {can("po:edit") ? (
            <Button asChild variant="outline">
              <Link href={`/pos/${po.id}/edit`}>
                <FilePenLine className="h-4 w-4" />
                Edit PO
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="brand">
            <Link href={`/projects/new?poId=${po.id}`}>
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">PO Value</p>
            <p className="text-lg font-bold">{formatINR(amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Remaining Value</p>
            <p className="text-lg font-bold text-green-600">{formatINR(remainingValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Utilisation</p>
            <p className="text-lg font-bold">{utilizationPct}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Working Days</p>
            <p className="text-lg font-bold">{po.expectedWorkingDays}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Scope and Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Scope of Work</p>
              <p className="mt-2 whitespace-pre-line text-sm">
                {details.scope || "No scope details were added for this PO."}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Internal Notes</p>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {details.additionalNotes || "No internal notes available."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">PO Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Timeline</p>
              </div>
              <p className="mt-3 text-muted-foreground">
                Start: {po.workStartDate ? formatDate(po.workStartDate) : "Not set"}
              </p>
              <p className="text-muted-foreground">Expiry: {formatDate(po.expiryDate)}</p>
              <p className="text-muted-foreground">Created: {formatDate(po.createdAt)}</p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Assigned Business Manager</p>
              </div>
              <p className="mt-3">{po.assignedPM?.name ?? "Not assigned"}</p>
              <p className="text-xs text-muted-foreground">{po.assignedPM?.email ?? "No email available"}</p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-medium">Payment Terms</p>
              <p className="mt-3 text-muted-foreground">{paymentTermsLabel}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {po.projects.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No projects have been linked to this PO yet.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href={`/projects/new?poId=${po.id}`}>Create First Project</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {po.projects.map((project) => (
                <div key={project.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.daysConsumed}/{project.daysAuthorised} days used · Created {formatDate(project.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{project.status.replace(/_/g, " ")}</Badge>
                    <Button asChild variant="ghost" size="icon">
                      <Link href={`/projects/${project.id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Related Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {po.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices have been raised against this PO yet.</p>
          ) : (
            <div className="space-y-3">
              {po.invoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(invoice.invoiceDate)} · {invoice.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold">{formatINR(invoice.totalAmount)}</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/invoices/${invoice.id}`}>Open</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
