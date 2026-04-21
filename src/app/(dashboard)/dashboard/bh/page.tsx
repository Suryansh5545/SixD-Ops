"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatCompact } from "@/lib/utils/currency";
import { formatDate, daysUntilExpiry } from "@/lib/utils/date";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
  const revenueByIndustry = data?.revenueByIndustry ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Business Head Dashboard</h1>
        <p className="text-muted-foreground text-sm">PO register and revenue breakdown</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Revenue by industry */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Sector</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="skeleton h-48 rounded" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={revenueByIndustry}
                    dataKey="total"
                    nameKey="sector"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
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
          </CardContent>
        </Card>

        {/* Summary stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PO Register Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total active POs</span>
              <span className="font-semibold">{poRegister.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total PO value</span>
              <span className="font-semibold">
                {formatCompact(poRegister.reduce((s: number, po: { amount: string }) => s + parseFloat(po.amount || "0"), 0))}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining value</span>
              <span className="font-semibold text-green-600">
                {formatCompact(poRegister.reduce((s: number, po: { remainingValue: string }) => s + parseFloat(po.remainingValue || "0"), 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PO Register table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PO Register</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}
            </div>
          ) : poRegister.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No POs found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">PO ID</th>
                    <th className="text-left py-2 pr-4 font-medium">Client</th>
                    <th className="text-right py-2 pr-4 font-medium">Amount</th>
                    <th className="text-right py-2 pr-4 font-medium">Remaining</th>
                    <th className="text-left py-2 pr-4 font-medium">Expiry</th>
                    <th className="text-left py-2 font-medium">PM</th>
                  </tr>
                </thead>
                <tbody>
                  {poRegister.map((po: { id: string; internalId: string; client: { name: string }; amount: string; remainingValue: string; expiryDate: string; assignedPM: { name: string } }) => {
                    const days = daysUntilExpiry(po.expiryDate);
                    return (
                      <tr key={po.id} className="border-b last:border-0 hover:bg-accent">
                        <td className="py-2.5 pr-4">
                          <Link href={`/pos/${po.id}`} className="text-brand-500 hover:underline font-medium">
                            {po.internalId}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4">{po.client.name}</td>
                        <td className="py-2.5 pr-4 text-right">{formatINR(po.amount, 0)}</td>
                        <td className="py-2.5 pr-4 text-right text-green-600">{formatINR(po.remainingValue, 0)}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5">
                            <span>{formatDate(po.expiryDate)}</span>
                            {days <= 7 && <Badge variant="destructive" className="text-xs">{days}d</Badge>}
                            {days > 7 && days <= 30 && <Badge variant="secondary" className="text-xs">{days}d</Badge>}
                          </div>
                        </td>
                        <td className="py-2.5">{po.assignedPM.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
