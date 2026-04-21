"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatINR } from "@/lib/utils/currency";
import { AlertTriangle, ArrowUpRight, Clock, DollarSign, TrendingUp, Wallet } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function CFODashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "cfo"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard?type=cfo");
      const json = await res.json();
      return json.data;
    },
  });

  const ageing = data?.receivablesAgeing;

  const chartData = (() => {
    const map: Record<string, { month: string; invoiced: number; collected: number }> = {};
    for (const d of data?.monthlyInvoiced ?? []) {
      map[d.month] = { month: d.month, invoiced: d.total, collected: 0 };
    }
    for (const d of data?.monthlyCollected ?? []) {
      if (!map[d.month]) map[d.month] = { month: d.month, invoiced: 0, collected: 0 };
      map[d.month].collected = d.total;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  })();

  const totalOverdue = (ageing?.bucket0to30 ?? 0) + (ageing?.bucket31to60 ?? 0) + (ageing?.bucket60plus ?? 0);
  const collectionsTotal = chartData.reduce((sum, item) => sum + item.collected, 0);
  const invoicedTotal = chartData.reduce((sum, item) => sum + item.invoiced, 0);
  const collectionCoverage = invoicedTotal > 0 ? Math.round((collectionsTotal / invoicedTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="Finance View"
        badge="Read Only"
        title="CFO Dashboard"
        description="Track receivables pressure, compare billing versus collections, and focus attention on the buckets that most affect cash flow."
        meta={[
          { label: "Total Overdue", value: formatCompact(totalOverdue) },
          { label: "Collections Coverage", value: `${collectionCoverage}%` },
          { label: "Invoiced Rolling 12M", value: formatCompact(invoicedTotal) },
          { label: "Collected Rolling 12M", value: formatCompact(collectionsTotal) },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Overdue"
          value={formatCompact(totalOverdue)}
          subtitle="Open receivables across all overdue ageing buckets."
          icon={AlertTriangle}
          variant={totalOverdue > 0 ? "danger" : "default"}
          loading={isLoading}
        />
        <StatCard
          title="0-30 Days"
          value={formatCompact(ageing?.bucket0to30 ?? 0)}
          subtitle="Fresh overdue receivables that still need active follow-up."
          icon={DollarSign}
          variant="warning"
          loading={isLoading}
        />
        <StatCard
          title="31-60 Days"
          value={formatCompact(ageing?.bucket31to60 ?? 0)}
          subtitle="Watchlist invoices at rising risk of delayed recovery."
          icon={Clock}
          variant="danger"
          loading={isLoading}
        />
        <StatCard
          title="60+ Days"
          value={formatCompact(ageing?.bucket60plus ?? 0)}
          subtitle="High-priority receivables requiring escalation."
          icon={TrendingUp}
          variant="danger"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <DashboardPanel
          title="Monthly Revenue vs Collection"
          description="A 12-month view to compare billing momentum against actual cash conversion."
        >
          {isLoading ? (
            <div className="skeleton h-72 rounded-2xl" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => formatINR(value, 0)}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="invoiced"
                  name="Invoiced"
                  stroke="#E85122"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="collected"
                  name="Collected"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Receivables Action Queue"
          description="Use the ageing mix to decide where finance follow-up should start this week."
        >
          <div className="space-y-3">
            {[
              {
                label: "Immediate escalations",
                value: ageing?.bucket60plus ?? 0,
                badge: "60+ days",
                tone: "border-rose-200 bg-rose-50/80",
                icon: AlertTriangle,
              },
              {
                label: "Manager review",
                value: ageing?.bucket31to60 ?? 0,
                badge: "31-60 days",
                tone: "border-amber-200 bg-amber-50/80",
                icon: ArrowUpRight,
              },
              {
                label: "Routine follow-up",
                value: ageing?.bucket0to30 ?? 0,
                badge: "0-30 days",
                tone: "border-sky-200 bg-sky-50/80",
                icon: Wallet,
              },
            ].map((bucket) => (
              <div
                key={bucket.label}
                className={`rounded-2xl border p-4 ${bucket.tone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">{bucket.label}</p>
                    <p className="text-2xl font-semibold">{formatCompact(bucket.value)}</p>
                  </div>
                  <bucket.icon className="h-5 w-5 text-foreground/70" />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <Badge variant="secondary">{bucket.badge}</Badge>
                  <span className="text-muted-foreground">{formatINR(bucket.value, 0)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Collections health</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Collections currently cover{" "}
              <span className="font-semibold text-foreground">{collectionCoverage}%</span> of rolling
              invoiced value over the last 12 months.
            </p>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
