"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { formatCompact } from "@/lib/utils/currency";
import { daysUntilExpiry, formatDate } from "@/lib/utils/date";
import { DAILY_STATUS_LABELS, PROJECT_STATUS_LABELS } from "@/types";
import {
  Activity,
  AlertTriangle,
  Building2,
  DollarSign,
  FileText,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import type { DailyStatus, ProjectStatus } from "@prisma/client";

export default function MDDashboardPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ["dashboard", "md"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard?type=md");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 60_000,
  });

  // Withhold data until mounted to guarantee the initial client render
  // exactly matches the server's HTML (prevents key hydration mismatches).
  const safeData = isMounted ? data : undefined;
  const isLoading = !isMounted || queryLoading;

  const stats = safeData?.stats;
  const teamStatuses = safeData?.teamStatuses ?? [];
  const expiringPOs = safeData?.expiringPOs ?? [];
  const projectStatusBreakdown = safeData?.projectStatusBreakdown ?? [];

  const activeStatusCount = teamStatuses.filter((eng: { currentStatus: DailyStatus | null }) =>
    ["WORKING_ON_JOB", "TRAVELLING_TO_SITE"].includes(eng.currentStatus ?? "")
  ).length;
  const blockedCount = teamStatuses.filter(
    (eng: { currentStatus: DailyStatus | null }) => eng.currentStatus === "STANDBY_BLOCKED"
  ).length;
  const statusHighlights = [...projectStatusBreakdown]
    .sort(
      (a: { _count: { status: number } }, b: { _count: { status: number } }) =>
        b._count.status - a._count.status
    )
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="Leadership View"
        badge="Live Operations"
        title="Managing Director Dashboard"
        description="A single view of delivery health, collections, and field movement so you can spot operational risk before it turns into a delay."
        meta={[
          { label: "Active Projects", value: isLoading ? "-" : String(stats?.activeProjects ?? 0) },
          { label: "Team On Site", value: isLoading ? "-" : String(stats?.teamOnSite ?? 0) },
          { label: "Collections This Month", value: isLoading ? "-" : formatCompact(stats?.totalCollectedMonth ?? 0) },
          { label: "POs Expiring Soon", value: isLoading ? "-" : String(stats?.posExpiringIn30Days ?? 0) },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Active Projects"
          value={stats?.activeProjects ?? 0}
          subtitle="Projects currently mobilised, on site, or in planning."
          icon={Building2}
          loading={isLoading}
        />
        <StatCard
          title="Invoiced This Month"
          value={formatCompact(stats?.totalInvoicedMonth ?? 0)}
          subtitle="Issued invoices excluding drafts in the current month."
          icon={DollarSign}
          variant="success"
          loading={isLoading}
        />
        <StatCard
          title="Collected This Month"
          value={formatCompact(stats?.totalCollectedMonth ?? 0)}
          subtitle="Cash received this month across all recorded payments."
          icon={TrendingUp}
          variant="success"
          loading={isLoading}
        />
        <StatCard
          title="Overdue Receivables"
          value={formatCompact(stats?.overdueReceivables ?? 0)}
          subtitle="Outstanding invoice balance past due date."
          icon={AlertTriangle}
          variant={stats?.overdueReceivables > 0 ? "danger" : "default"}
          loading={isLoading}
        />
        <StatCard
          title="Team On-Site"
          value={stats?.teamOnSite ?? 0}
          subtitle={`${activeStatusCount} engineers travelling or working today.`}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="POs Expiring (30d)"
          value={stats?.posExpiringIn30Days ?? 0}
          subtitle="Contracts that need proactive extension or closure."
          icon={FileText}
          variant={stats?.posExpiringIn30Days > 0 ? "warning" : "default"}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardPanel
          title="Project Status Snapshot"
          description="The largest workflow buckets right now, ordered by volume so you can quickly see where work is concentrating."
        >
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
          ) : statusHighlights.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 py-10 text-center text-sm text-muted-foreground">
              No status data is available yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {statusHighlights.map((item: { status: ProjectStatus; _count: { status: number } }) => (
                <div
                  key={item.status}
                  className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Current queue</p>
                      <p className="text-lg font-semibold text-foreground">
                        {PROJECT_STATUS_LABELS[item.status]}
                      </p>
                    </div>
                    <ProjectStatusBadge status={item.status} className="shrink-0" />
                  </div>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">
                    {item._count.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Field Visibility"
          description="Engineer deployment status with emphasis on blocked or inactive capacity."
        >
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-emerald-50/50 p-4 dark:bg-emerald-500/10">
              <p className="text-sm font-medium tracking-tight text-emerald-600 dark:text-emerald-500">Active today</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">{isLoading ? "-" : activeStatusCount}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-rose-50/50 p-4 dark:bg-rose-500/10">
              <p className="text-sm font-medium tracking-tight text-rose-600 dark:text-rose-500">Blocked</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-rose-700 dark:text-rose-400">{isLoading ? "-" : blockedCount}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : teamStatuses.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 py-10 text-center text-sm text-muted-foreground">
              No engineers are available in the deployment feed yet.
            </p>
          ) : (
            <div className="space-y-2">
              {teamStatuses.map((eng: { id: string; user: { name: string }; division: string; level: string; currentStatus: DailyStatus | null }) => (
                <div
                  key={eng.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
                      {eng.user.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{eng.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {eng.division} / {eng.level}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      eng.currentStatus === "WORKING_ON_JOB"
                        ? "success"
                        : eng.currentStatus === "STANDBY_BLOCKED"
                          ? "destructive"
                          : eng.currentStatus === "TRAVELLING_TO_SITE"
                            ? "brand"
                            : "secondary"
                    }
                  >
                    {eng.currentStatus ? DAILY_STATUS_LABELS[eng.currentStatus] : "Available"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="POs Expiring Soon"
        description="Contracts closing in the next 30 days, prioritised for renewal or commercial follow-up."
        action={
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Activity className="h-4 w-4" />
            Review weekly
          </div>
        }
      >
        {isLoading ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : expiringPOs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-10 text-center dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <ShieldAlert className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-500" />
            <p className="mt-3 text-sm font-medium text-emerald-800 dark:text-emerald-400">
              No purchase orders are expiring in the next 30 days.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {expiringPOs.map((po: { id: string; internalId: string; client: { name: string }; expiryDate: string; assignedPM: { name: string } }) => {
              const days = daysUntilExpiry(po.expiryDate);
              return (
                <div
                  key={po.id}
                  className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-base font-semibold">{po.internalId}</p>
                      <p className="text-sm text-muted-foreground">{po.client.name}</p>
                    </div>
                    <Badge variant={days <= 7 ? "destructive" : "warning"}>
                      {days}d left
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span>Expiry: {formatDate(po.expiryDate)}</span>
                    <span>Owner: {po.assignedPM.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
