"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { PODayCounter } from "@/components/projects/PODayCounter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { ClipboardList, Receipt, DollarSign, AlertTriangle, ArrowRight } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your projects, actions, and receivables</p>
      </div>

      {/* Quick action banners */}
      {invoicesToRaise.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                {invoicesToRaise.length} project{invoicesToRaise.length > 1 ? "s" : ""} ready for invoicing
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">Work completed — initiate invoice to proceed</p>
            </div>
          </div>
          <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
            <Link href="/projects?status=WORK_COMPLETED">View <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </div>
      )}

      {pendingExpenses.length > 0 && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-200">
                Expense claims pending approval
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {pendingExpenses.reduce((sum: number, p: { _count: { expenseClaims: number } }) => sum + p._count.expenseClaims, 0)} claim(s) across {pendingExpenses.length} project(s)
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/projects">Review <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </div>
      )}

      {overdueReceivables.length > 0 && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="font-semibold text-red-800 dark:text-red-200">
              {overdueReceivables.length} overdue invoice{overdueReceivables.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-2">
            {overdueReceivables.slice(0, 3).map((inv: { id: string; invoiceNumber: string; project: { client: { name: string } }; balanceDue: string; dueDate: string }) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <span className="text-red-700 dark:text-red-300">
                  {inv.invoiceNumber} · {inv.project.client.name}
                </span>
                <span className="font-medium text-red-800 dark:text-red-200">
                  {formatINR(inv.balanceDue)} due {formatDate(inv.dueDate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My projects list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            My Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded" />)}
            </div>
          ) : myProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No projects assigned yet</p>
          ) : (
            <div className="space-y-3">
              {myProjects.map((proj: { id: string; name: string; status: ProjectStatus; client: { name: string }; po: { internalId: string; expiryDate: string; expectedWorkingDays: number }; daysConsumed: number; daysAuthorised: number }) => (
                <Link
                  key={proj.id}
                  href={`/projects/${proj.id}`}
                  className="block rounded-lg border p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{proj.name}</p>
                      <p className="text-xs text-muted-foreground">{proj.client.name} · {proj.po.internalId}</p>
                      <div className="mt-2">
                        <PODayCounter
                          daysConsumed={proj.daysConsumed}
                          daysAuthorised={proj.daysAuthorised}
                        />
                      </div>
                    </div>
                    <ProjectStatusBadge status={proj.status} className="shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
