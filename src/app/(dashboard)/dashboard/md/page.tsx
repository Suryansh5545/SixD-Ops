"use client";

import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCompact } from "@/lib/utils/currency";
import { formatDate, daysUntilExpiry } from "@/lib/utils/date";
import { PROJECT_STATUS_LABELS, DAILY_STATUS_LABELS } from "@/types";
import { Building2, DollarSign, TrendingUp, AlertTriangle, Users, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import type { ProjectStatus, DailyStatus } from "@prisma/client";

export default function MDDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "md"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard?type=md");
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 60_000, // Refresh every minute
  });

  const stats = data?.stats;
  const teamStatuses = data?.teamStatuses ?? [];
  const expiringPOs = data?.expiringPOs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MD Dashboard</h1>
        <p className="text-muted-foreground text-sm">SixD Engineering Solutions — Real-time operations overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Active Projects"
          value={stats?.activeProjects ?? 0}
          icon={Building2}
          loading={isLoading}
        />
        <StatCard
          title="Invoiced This Month"
          value={formatCompact(stats?.totalInvoicedMonth ?? 0)}
          icon={DollarSign}
          variant="success"
          loading={isLoading}
        />
        <StatCard
          title="Collected This Month"
          value={formatCompact(stats?.totalCollectedMonth ?? 0)}
          icon={TrendingUp}
          variant="success"
          loading={isLoading}
        />
        <StatCard
          title="Overdue Receivables"
          value={formatCompact(stats?.overdueReceivables ?? 0)}
          icon={AlertTriangle}
          variant={stats?.overdueReceivables > 0 ? "danger" : "default"}
          loading={isLoading}
        />
        <StatCard
          title="Team On-Site"
          value={stats?.teamOnSite ?? 0}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="POs Expiring (30d)"
          value={stats?.posExpiringIn30Days ?? 0}
          icon={FileText}
          variant={stats?.posExpiringIn30Days > 0 ? "warning" : "default"}
          loading={isLoading}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Team deployment map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team Deployment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton h-10 rounded" />
                ))}
              </div>
            ) : teamStatuses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No engineers deployed</p>
            ) : (
              <div className="space-y-2">
                {teamStatuses.map((eng: { id: string; user: { name: string }; division: string; level: string; currentStatus: DailyStatus | null }) => (
                  <div key={eng.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{eng.user.name}</p>
                      <p className="text-xs text-muted-foreground">{eng.division} · {eng.level}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={
                        eng.currentStatus === "WORKING_ON_JOB"
                          ? "bg-green-100 text-green-700"
                          : eng.currentStatus === "STANDBY_BLOCKED"
                          ? "bg-red-100 text-red-700"
                          : eng.currentStatus === "TRAVELLING_TO_SITE"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {eng.currentStatus ? DAILY_STATUS_LABELS[eng.currentStatus] : "Available"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PO expiry alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">POs Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="skeleton h-14 rounded" />
                ))}
              </div>
            ) : expiringPOs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No POs expiring in next 30 days</p>
            ) : (
              <div className="space-y-3">
                {expiringPOs.map((po: { id: string; internalId: string; client: { name: string }; expiryDate: string; assignedPM: { name: string } }) => {
                  const days = daysUntilExpiry(po.expiryDate);
                  return (
                    <div key={po.id} className="flex items-start justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{po.internalId}</p>
                        <p className="text-xs text-muted-foreground">{po.client.name} · PM: {po.assignedPM.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(po.expiryDate)}</p>
                      </div>
                      <Badge variant={days <= 7 ? "destructive" : "secondary"}>
                        {days}d left
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
