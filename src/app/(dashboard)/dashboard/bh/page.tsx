"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatINR } from "@/lib/utils/currency";
import { daysUntilExpiry, formatDate } from "@/lib/utils/date";
import {
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  PieChart as PieChartIcon,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const SECTOR_COLORS = ["#E85122", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4"];

export default function BHDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "bh"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard?type=bh");
      const json = await res.json();
      return json.data;
    },
  });

  const poRegister = data?.poRegister ?? [];
  const revenueByClient = data?.revenueByClient ?? [];
  const revenueByIndustry = data?.revenueByIndustry ?? [];
  const totalPOValue = poRegister.reduce(
    (sum: number, po: { amount: string }) => sum + parseFloat(po.amount || "0"),
    0
  );
  const totalRemainingValue = poRegister.reduce(
    (sum: number, po: { remainingValue: string }) => sum + parseFloat(po.remainingValue || "0"),
    0
  );

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="Commercial View"
        badge="Revenue and PO Health"
        title="Business Head Dashboard"
        description="Monitor purchase order value, portfolio mix, and upcoming commercial exposure across clients and industry sectors."
        meta={[
          { label: "Active POs", value: String(poRegister.length) },
          { label: "Total PO Value", value: formatCompact(totalPOValue) },
          { label: "Remaining Value", value: formatCompact(totalRemainingValue) },
          { label: "Tracked Sectors", value: String(revenueByIndustry.length) },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Active POs"
          value={poRegister.length}
          subtitle="All purchase orders currently in the register."
          icon={BriefcaseBusiness}
          loading={isLoading}
        />
        <StatCard
          title="Total PO Value"
          value={formatCompact(totalPOValue)}
          subtitle="Gross order value across the active register."
          icon={CircleDollarSign}
          variant="success"
          loading={isLoading}
        />
        <StatCard
          title="Remaining Value"
          value={formatCompact(totalRemainingValue)}
          subtitle="Commercial headroom still available to bill."
          icon={Building2}
          variant="warning"
          loading={isLoading}
        />
        <StatCard
          title="Sector Spread"
          value={revenueByIndustry.length}
          subtitle="Number of sectors contributing invoiced revenue."
          icon={PieChartIcon}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardPanel
          title="Revenue by Sector"
          description="Portfolio mix based on invoiced value, useful for concentration and diversification checks."
        >
          {isLoading ? (
            <div className="skeleton h-56 rounded-2xl" />
          ) : revenueByIndustry.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/80 py-10 text-center text-sm text-muted-foreground">
              No invoiced revenue data is available yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={revenueByIndustry}
                  dataKey="total"
                  nameKey="sector"
                  cx="50%"
                  cy="50%"
                  outerRadius={86}
                  label={({ sector, percent }) => `${sector} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {revenueByIndustry.map((_: unknown, index: number) => (
                    <Cell key={index} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v, 0)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Top Revenue Accounts"
          description="The highest-contributing client accounts by invoiced value."
        >
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
            </div>
          ) : revenueByClient.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/80 py-10 text-center text-sm text-muted-foreground">
              No client revenue records are available yet.
            </p>
          ) : (
            <div className="space-y-3">
              {revenueByClient.map((client: { clientName: string; total: number }, index: number) => (
                <div
                  key={client.clientName}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-100 font-semibold text-brand-700">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{client.clientName}</p>
                      <p className="text-xs text-muted-foreground">Invoiced contribution</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{formatINR(client.total, 0)}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="PO Register"
        description="A commercial watchlist of active orders, remaining value, expiry dates, and project owners."
      >
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}
          </div>
        ) : poRegister.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/80 py-10 text-center text-sm text-muted-foreground">
            No purchase orders were found.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">PO ID</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-right font-medium">Remaining</th>
                  <th className="px-4 py-3 text-left font-medium">Expiry</th>
                  <th className="px-4 py-3 text-left font-medium">Business Manager</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {poRegister.map((po: { id: string; internalId: string; client: { name: string }; amount: string; remainingValue: string; expiryDate: string; assignedPM: { name: string } }) => {
                  const days = daysUntilExpiry(po.expiryDate);
                  return (
                    <tr key={po.id} className="hover:bg-muted/20">
                      <td className="px-4 py-4">
                        <Link href={`/pos/${po.id}`} className="font-medium text-brand-500 hover:underline">
                          {po.internalId}
                        </Link>
                      </td>
                      <td className="px-4 py-4">{po.client.name}</td>
                      <td className="px-4 py-4 text-right font-medium">{formatINR(po.amount, 0)}</td>
                      <td className="px-4 py-4 text-right font-medium text-emerald-700">
                        {formatINR(po.remainingValue, 0)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span>{formatDate(po.expiryDate)}</span>
                          {days <= 7 && <Badge variant="destructive" className="text-xs">{days}d</Badge>}
                          {days > 7 && days <= 30 && <Badge variant="warning" className="text-xs">{days}d</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-4">{po.assignedPM.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
