"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft, Users, ClipboardList, Receipt, FileText,
  MapPin, Calendar, Clock, AlertTriangle, ChevronRight,
  Edit2, ExternalLink
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { StatusTimeline } from "@/components/shared/StatusTimeline";
import { formatINR } from "@/lib/utils/currency";
import { toIST } from "@/lib/utils/date";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ProjectDetail {
  id: string;
  projectId: string;
  title: string;
  status: string;
  division: string;
  location: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  expectedWorkingDays: number;
  daysConsumed: number;
  dailyRate: number;
  extraHours: number;
  standbyHoursTotal: number;
  quotaAlertSent: boolean;
  notes?: string;
  po: {
    id: string;
    poNumber: string;
    amount: number;
    remainingValue: number;
    client: { name: string; gstPercent: number };
  };
  projectManager?: { id: string; name: string; email: string };
  engineers: Array<{
    id: string;
    name: string;
    division: string;
    currentStatus: string;
    role: string;
  }>;
  equipment: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    status: string;
    category: string;
    description: string;
    submittedAt: string;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    status: string;
    issuedAt?: string;
  }>;
  complianceGate: {
    passed: boolean;
    missing: string[];
  };
  auditLog: Array<{
    id: string;
    action: string;
    createdAt: string;
    user: { name: string };
  }>;
}

const STATUS_NEXT_ACTIONS: Record<string, string[]> = {
  PO_RECEIVED: ["MOBILISATION"],
  MOBILISATION: ["TEAM_ASSIGNED"],
  TEAM_ASSIGNED: ["WORK_IN_PROGRESS"],
  WORK_IN_PROGRESS: ["WORK_COMPLETED", "BLOCKED"],
  BLOCKED: ["WORK_IN_PROGRESS"],
  WORK_COMPLETED: ["INVOICE_READY"],
  INVOICE_READY: ["INVOICE_SUBMITTED"],
  INVOICE_SUBMITTED: ["INVOICE_APPROVED"],
  INVOICE_APPROVED: ["INVOICE_SENT"],
  INVOICE_SENT: ["PARTIALLY_PAID", "PAYMENT_RECEIVED"],
  PARTIALLY_PAID: ["PAYMENT_RECEIVED"],
  PAYMENT_RECEIVED: [],
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ["project", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const advanceStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/projects"><Button variant="outline">Back to Projects</Button></Link>
      </div>
    );
  }

  const quotaPct = project.expectedWorkingDays > 0
    ? (project.daysConsumed / project.expectedWorkingDays) * 100
    : 0;

  const nextStatuses = STATUS_NEXT_ACTIONS[project.status] ?? [];
  const approvedExpenses = project.expenses
    .filter((e) => e.status === "APPROVED")
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{project.title}</h1>
              <ProjectStatusBadge status={project.status as never} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="font-mono">{project.projectId}</span>
              <span>·</span>
              <span>{project.po.client.name}</span>
              <span>·</span>
              <span>{project.division}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {project.location}
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2">
          {can("logsheet:view_own") && (
            <Link href={`/projects/${id}/logsheet`}>
              <Button variant="outline" size="sm">
                <Clock className="h-4 w-4" />
                Log Sheet
              </Button>
            </Link>
          )}
          {can("invoice:initiate") && project.status === "WORK_COMPLETED" && (
            <Link href={`/projects/${id}/invoice`}>
              <Button variant="brand" size="sm">
                <Receipt className="h-4 w-4" />
                Generate Invoice
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Compliance alert */}
      {!project.complianceGate.passed && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Compliance gate:</strong> Missing documents —{" "}
            {project.complianceGate.missing.join(", ")}. Invoice cannot be generated until resolved.
          </AlertDescription>
        </Alert>
      )}

      {/* Quota alert */}
      {quotaPct >= 80 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Quota alert:</strong> {project.daysConsumed} of {project.expectedWorkingDays} days consumed ({Math.round(quotaPct)}%).
            Contact the business manager to review scope or raise a PO amendment.
          </AlertDescription>
        </Alert>
      )}

      {/* Status advance */}
      {nextStatuses.length > 0 && can("project:update_status") && (
        <div className="flex items-center gap-2 rounded-xl border bg-card p-4">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Advance to:</p>
          {nextStatuses.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              loading={advanceStatus.isPending}
              onClick={() => advanceStatus.mutate(s)}
            >
              {s.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Daily Rate</p>
            <p className="text-lg font-bold">{formatINR(project.dailyRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Days Consumed</p>
            <p className="text-lg font-bold">{project.daysConsumed} / {project.expectedWorkingDays}</p>
            <Progress value={quotaPct} className="h-1 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Extra Hours</p>
            <p className="text-lg font-bold">{project.extraHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Approved Expenses</p>
            <p className="text-lg font-bold">{formatINR(approvedExpenses)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="expenses">
            Expenses
            {project.expenses.filter(e => e.status === "PENDING_APPROVAL").length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 text-white text-xs px-1.5 py-0.5">
                {project.expenses.filter(e => e.status === "PENDING_APPROVAL").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planned Start</span>
                  <span>{format(new Date(project.plannedStartDate), "dd MMM yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planned End</span>
                  <span>{format(new Date(project.plannedEndDate), "dd MMM yyyy")}</span>
                </div>
                {project.actualStartDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actual Start</span>
                    <span className="text-green-600">{format(new Date(project.actualStartDate), "dd MMM yyyy")}</span>
                  </div>
                )}
                {project.actualEndDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actual End</span>
                    <span>{format(new Date(project.actualEndDate), "dd MMM yyyy")}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Purchase Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PO Number</span>
                  <Link href={`/pos/${project.po.id}`} className="flex items-center gap-1 text-primary hover:underline">
                    {project.po.poNumber}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PO Value</span>
                  <span>{formatINR(project.po.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="text-green-600">{formatINR(project.po.remainingValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST Rate</span>
                  <span>{project.po.client.gstPercent}%</span>
                </div>
              </CardContent>
            </Card>

            {project.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{project.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Deployed Engineers</h3>
              {can("planning:assign_team") && (
                <Link href={`/projects/${id}/planning`}>
                  <Button size="sm" variant="outline">
                    <Users className="h-4 w-4" />
                    Manage Team
                  </Button>
                </Link>
              )}
            </div>

            {project.projectManager && (
              <Card>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{project.projectManager.name}</p>
                    <p className="text-xs text-muted-foreground">{project.projectManager.email}</p>
                  </div>
                  <Badge variant="brand">Business Manager</Badge>
                </CardContent>
              </Card>
            )}

            {project.engineers.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No engineers assigned yet</p>
                {can("planning:assign_team") && (
                  <Link href={`/projects/${id}/planning`}>
                    <Button variant="outline" size="sm" className="mt-3">Assign Team</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {project.engineers.map((eng) => (
                  <Card key={eng.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{eng.name}</p>
                        <p className="text-xs text-muted-foreground">{eng.division} · {eng.role}</p>
                      </div>
                      <Badge
                        variant={
                          eng.currentStatus === "WORKING" ? "success"
                            : eng.currentStatus === "STANDBY" ? "warning"
                            : "muted"
                        }
                      >
                        {eng.currentStatus}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {project.equipment.length > 0 && (
              <>
                <Separator />
                <h3 className="font-semibold">Equipment</h3>
                <div className="space-y-2">
                  {project.equipment.map((eq) => (
                    <Card key={eq.id}>
                      <CardContent className="py-3">
                        <p className="font-medium text-sm">{eq.name}</p>
                        <p className="text-xs text-muted-foreground">{eq.type}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Expenses */}
        <TabsContent value="expenses">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Expenses</h3>
              <Link href={`/projects/${id}/expenses`}>
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4" />
                  Full View
                </Button>
              </Link>
            </div>

            {project.expenses.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <p className="text-sm text-muted-foreground">No expenses recorded</p>
              </div>
            ) : (
              <div className="space-y-2">
                {project.expenses.slice(0, 5).map((exp) => (
                  <Card key={exp.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{exp.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {exp.category} · {format(new Date(exp.submittedAt), "dd MMM yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{formatINR(exp.amount)}</p>
                        <Badge
                          variant={
                            exp.status === "APPROVED" ? "success"
                              : exp.status === "REJECTED" ? "destructive"
                              : "warning"
                          }
                          className="text-xs"
                        >
                          {exp.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {project.expenses.length > 5 && (
                  <Link href={`/projects/${id}/expenses`}>
                    <Button variant="ghost" size="sm" className="w-full">
                      View all {project.expenses.length} expenses
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Invoices</h3>
              {can("invoice:initiate") && project.status === "WORK_COMPLETED" && (
                <Link href={`/projects/${id}/invoice`}>
                  <Button size="sm" variant="brand">
                    <Receipt className="h-4 w-4" />
                    Generate Invoice
                  </Button>
                </Link>
              )}
            </div>

            {project.invoices.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center">
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {project.invoices.map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm font-mono">{inv.invoiceNumber}</p>
                        {inv.issuedAt && (
                          <p className="text-xs text-muted-foreground">
                            Issued {format(new Date(inv.issuedAt), "dd MMM yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatINR(inv.totalAmount)}</p>
                        <Badge variant="outline" className="text-xs">
                          {inv.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Project documents and compliance files</p>
            <Link href={`/projects/${id}/documents`}>
              <Button variant="outline">Open Documents</Button>
            </Link>
          </div>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline entries={project.auditLog.map((log) => ({
                id: log.id,
                status: log.action,
                label: log.action.replace(/_/g, " "),
                timestamp: log.createdAt,
                actor: log.user.name,
              }))} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
