"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { PODayCounter } from "@/components/projects/PODayCounter";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  DollarSign,
  FolderKanban,
  Layers3,
  Receipt,
} from "lucide-react";
import type { ProjectStatus } from "@prisma/client";

export default function PMDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "pm"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard?type=pm");
      const json = await res.json();
      return json.data;
    },
  });

  const myProjects = data?.myProjects ?? [];
  const pendingExpenses = data?.pendingExpenses ?? [];
  const invoicesToRaise = data?.invoicesToRaise ?? [];
  const overdueReceivables = data?.overdueReceivables ?? [];

  const pendingClaimCount = pendingExpenses.reduce(
    (sum: number, p: { _count: { expenseClaims: number } }) => sum + p._count.expenseClaims,
    0
  );
  const overdueBalance = overdueReceivables.reduce(
    (sum: number, inv: { balanceDue: string }) => sum + parseFloat(inv.balanceDue || "0"),
    0
  );

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="Execution View"
        badge="Action Focused"
        title="My Dashboard"
        description="Your project queue, approvals, and invoice follow-up in one place so the next action is always obvious."
        meta={[
          { label: "Assigned Projects", value: String(myProjects.length) },
          { label: "Pending Claims", value: String(pendingClaimCount) },
          { label: "Ready to Invoice", value: String(invoicesToRaise.length) },
          { label: "Overdue Value", value: formatINR(overdueBalance, 0) },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Assigned Projects"
          value={myProjects.length}
          subtitle="Projects currently owned by you."
          icon={FolderKanban}
          loading={isLoading}
        />
        <StatCard
          title="Pending Expense Claims"
          value={pendingClaimCount}
          subtitle={`${pendingExpenses.length} project${pendingExpenses.length === 1 ? "" : "s"} need review.`}
          icon={DollarSign}
          variant={pendingClaimCount > 0 ? "warning" : "default"}
          loading={isLoading}
        />
        <StatCard
          title="Ready for Invoicing"
          value={invoicesToRaise.length}
          subtitle="Projects completed and waiting for invoice initiation."
          icon={Receipt}
          variant={invoicesToRaise.length > 0 ? "success" : "default"}
          loading={isLoading}
        />
        <StatCard
          title="Overdue Receivables"
          value={formatINR(overdueBalance, 0)}
          subtitle={`${overdueReceivables.length} invoice${overdueReceivables.length === 1 ? "" : "s"} need follow-up.`}
          icon={AlertTriangle}
          variant={overdueReceivables.length > 0 ? "danger" : "default"}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardPanel
          title="Action Queue"
          description="The most important actions that need attention right now."
        >
          <div className="space-y-3">
            {[
              {
                title: "Projects ready for invoicing",
                description: `${invoicesToRaise.length} project${invoicesToRaise.length === 1 ? "" : "s"} are past delivery milestones and should move into invoicing.`,
                href: "/projects?status=WORK_COMPLETED",
                cta: "Open invoicing queue",
                icon: Receipt,
                tone: "border-amber-200 bg-amber-50/80",
                show: invoicesToRaise.length > 0,
              },
              {
                title: "Expense approvals pending",
                description: `${pendingClaimCount} claim${pendingClaimCount === 1 ? "" : "s"} are waiting across ${pendingExpenses.length} project${pendingExpenses.length === 1 ? "" : "s"}.`,
                href: "/projects",
                cta: "Review expenses",
                icon: DollarSign,
                tone: "border-sky-200 bg-sky-50/80",
                show: pendingClaimCount > 0,
              },
              {
                title: "Overdue customer follow-up",
                description: `${overdueReceivables.length} overdue invoice${overdueReceivables.length === 1 ? "" : "s"} currently total ${formatINR(overdueBalance, 0)}.`,
                href: "/invoices",
                cta: "Review invoices",
                icon: AlertTriangle,
                tone: "border-rose-200 bg-rose-50/80",
                show: overdueReceivables.length > 0,
              },
            ]
              .filter((item) => item.show)
              .map((item) => (
                <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-foreground/80" />
                        <p className="font-semibold text-foreground">{item.title}</p>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </div>
                    <Link
                      href={item.href}
                      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {item.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}

            {!isLoading &&
              pendingClaimCount === 0 &&
              invoicesToRaise.length === 0 &&
              overdueReceivables.length === 0 && (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center">
                  <Layers3 className="mx-auto h-8 w-8 text-emerald-600" />
                  <p className="mt-3 text-sm font-medium text-emerald-900">No urgent actions right now.</p>
                  <p className="mt-1 text-sm text-emerald-800/80">Your current project queue looks healthy.</p>
                </div>
              )}

            {isLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-28 rounded-2xl" />
                ))}
              </div>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Receivables Needing Follow-Up"
          description="Oldest overdue invoices first so collection calls start with the most urgent items."
        >
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
            </div>
          ) : overdueReceivables.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/80 py-10 text-center text-sm text-muted-foreground">
              No overdue receivables assigned to your projects.
            </p>
          ) : (
            <div className="space-y-3">
              {overdueReceivables.slice(0, 5).map((inv: { id: string; invoiceNumber: string; project: { client: { name: string } }; balanceDue: string; dueDate: string }) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{inv.project.client.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatINR(inv.balanceDue, 0)}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="My Projects"
        description="A compact delivery queue showing status and PO day consumption at a glance."
        action={
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ClipboardList className="h-4 w-4" />
            Updated by latest activity
          </div>
        }
      >
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : myProjects.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/80 py-10 text-center text-sm text-muted-foreground">
            No projects are assigned to you yet.
          </p>
        ) : (
          <div className="space-y-3">
            {myProjects.map((proj: { id: string; name: string; status: ProjectStatus; client: { name: string }; po: { internalId: string; expiryDate: string; expectedWorkingDays: number }; daysConsumed: number; daysAuthorised: number }) => (
              <Link
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="block rounded-[24px] border border-border/70 bg-background p-5 transition-colors hover:bg-muted/20"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold">{proj.name}</p>
                      <ProjectStatusBadge status={proj.status} className="shrink-0" />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {proj.client.name} / {proj.po.internalId}
                    </p>
                    <div className="mt-4">
                      <PODayCounter
                        daysConsumed={proj.daysConsumed}
                        daysAuthorised={proj.daysAuthorised}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary">Expiry {formatDate(proj.po.expiryDate)}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
