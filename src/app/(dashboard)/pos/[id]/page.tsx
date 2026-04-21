"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Plus, Calendar, DollarSign, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatINR } from "@/lib/utils/currency";

interface PO {
  id: string;
  poNumber: string;
  clientId: string;
  client: { name: string };
  scope: string;
  amount: number;
  remainingValue: number;
  currency: string;
  startDate: string;
  endDate: string;
  division: "TS" | "LSS";
  status: string;
  notes?: string;
  projects: Array<{
    id: string;
    projectId: string;
    title: string;
    status: string;
    division: string;
  }>;
  createdAt: string;
}

const STATUS_BADGE: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  ACTIVE: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "destructive",
  COMPLETED: "muted",
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: po, isLoading } = useQuery<PO>({
    queryKey: ["po", id],
    queryFn: async () => {
      const res = await fetch(`/api/pos/${id}`);
      if (!res.ok) throw new Error("Failed to fetch PO");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground">PO not found.</p>
        <Link href="/pos"><Button variant="outline">Back to POs</Button></Link>
      </div>
    );
  }

  const utilizationPct = po.amount > 0
    ? Math.round(((po.amount - po.remainingValue) / po.amount) * 100)
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{po.poNumber}</h1>
              <Badge variant={STATUS_BADGE[po.status] ?? "outline"}>{po.status.replace(/_/g, " ")}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{po.client.name} · {po.division} Division</p>
          </div>
        </div>
        <Link href={`/projects/new?poId=${po.id}`}>
          <Button variant="brand" size="sm">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold">{formatINR(po.amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-lg font-bold text-green-600">{formatINR(po.remainingValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Utilised</p>
            <p className="text-lg font-bold">{utilizationPct}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Projects</p>
            <p className="text-lg font-bold">{po.projects.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Scope */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Scope of Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line">{po.scope}</p>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Start Date</p>
            <p className="font-medium">{format(new Date(po.startDate), "dd MMM yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">End Date</p>
            <p className="font-medium">{format(new Date(po.endDate), "dd MMM yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">{format(new Date(po.createdAt), "dd MMM yyyy")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {po.projects.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No projects created against this PO yet.</p>
              <Link href={`/projects/new?poId=${po.id}`}>
                <Button variant="outline" size="sm" className="mt-3">
                  <Plus className="h-3 w-3 mr-1" />
                  Create First Project
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {po.projects.map((proj) => (
                <div key={proj.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium text-sm">{proj.title}</p>
                    <p className="text-xs text-muted-foreground">{proj.projectId} · {proj.division}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {proj.status.replace(/_/g, " ")}
                    </Badge>
                    <Link href={`/projects/${proj.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {po.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{po.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
