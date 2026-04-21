"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCompact, formatINR } from "@/lib/utils/currency";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { DollarSign, TrendingUp, Clock, AlertTriangle } from "lucide-react";

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
  const totalOverdue = (ageing?.bucket0to30 ?? 0) + (ageing?.bucket31to60 ?? 0) + (ageing?.bucket60plus ?? 0);

  // Merge invoice and collection data for the chart
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CFO Dashboard</h1>
        <p className="text-muted-foreground text-sm">Financial overview — read only</p>
      </div>

      {/* Receivables ageing */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Overdue"
          value={formatCompact(totalOverdue)}
          icon={AlertTriangle}
          variant={totalOverdue > 0 ? "danger" : "default"}
          loading={isLoading}
        />
        <StatCard
          title="0–30 Days"
          value={formatCompact(ageing?.bucket0to30 ?? 0)}
          icon={DollarSign}
          variant="warning"
          loading={isLoading}
        />
        <StatCard
          title="31–60 Days"
          value={formatCompact(ageing?.bucket31to60 ?? 0)}
          icon={Clock}
          variant="danger"
          loading={isLoading}
        />
        <StatCard
          title="60+ Days"
          value={formatCompact(ageing?.bucket60plus ?? 0)}
          icon={TrendingUp}
          variant="danger"
          loading={isLoading}
        />
      </div>

      {/* Revenue vs collection trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Revenue vs. Collection (12 months)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="skeleton h-64 rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v) => formatCompact(v)}
                  tick={{ fontSize: 11 }}
                />
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
        </CardContent>
      </Card>
    </div>
  );
}
