"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Search, Filter } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Link from "next/link";

interface Engineer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  division: "TS" | "LSS";
  currentStatus: "IDLE" | "WORKING" | "STANDBY" | "ON_LEAVE";
  activeProject?: {
    id: string;
    projectId: string;
    title: string;
    client: { name: string };
  };
}

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: "success" | "warning" | "muted" | "info";
  dot: string;
}> = {
  WORKING: { label: "Working", variant: "success", dot: "bg-green-500" },
  STANDBY: { label: "Standby", variant: "warning", dot: "bg-amber-500" },
  IDLE: { label: "Available", variant: "muted", dot: "bg-slate-400" },
  ON_LEAVE: { label: "On Leave", variant: "info", dot: "bg-blue-500" },
};

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState<"ALL" | "TS" | "LSS">("ALL");

  const { data: engineers, isLoading } = useQuery<Engineer[]>({
    queryKey: ["engineers"],
    queryFn: async () => {
      const res = await fetch("/api/engineers");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filtered = (engineers ?? []).filter((e) => {
    const matchSearch = search === "" ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.activeProject?.title.toLowerCase().includes(search.toLowerCase());
    const matchDiv = division === "ALL" || e.division === division;
    return matchSearch && matchDiv;
  });

  const grouped = {
    TS: filtered.filter((e) => e.division === "TS"),
    LSS: filtered.filter((e) => e.division === "LSS"),
  };

  const stats = {
    total: engineers?.length ?? 0,
    working: engineers?.filter((e) => e.currentStatus === "WORKING").length ?? 0,
    standby: engineers?.filter((e) => e.currentStatus === "STANDBY").length ?? 0,
    idle: engineers?.filter((e) => e.currentStatus === "IDLE").length ?? 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Field Team</h1>
          <p className="text-sm text-muted-foreground">Real-time deployment status</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Engineers</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Working</p>
            <p className="text-2xl font-bold text-green-600">{stats.working}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Standby</p>
            <p className="text-2xl font-bold text-amber-600">{stats.standby}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-2xl font-bold text-slate-600">{stats.idle}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search engineers…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["ALL", "TS", "LSS"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDivision(d)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                division === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
            >
              {d === "ALL" ? "All" : d}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(n => <Skeleton key={n} className="h-32 w-full" />)}
        </div>
      ) : (
        <Tabs defaultValue="ALL">
          <TabsList>
            <TabsTrigger value="ALL">All ({filtered.length})</TabsTrigger>
            <TabsTrigger value="TS">TS ({grouped.TS.length})</TabsTrigger>
            <TabsTrigger value="LSS">LS&S ({grouped.LSS.length})</TabsTrigger>
          </TabsList>

          {["ALL", "TS", "LSS"].map((tab) => {
            const list = tab === "ALL" ? filtered : filtered.filter(e => e.division === tab);
            return (
              <TabsContent key={tab} value={tab}>
                {list.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No engineers match your filter</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((eng) => {
                      const cfg = STATUS_CONFIG[eng.currentStatus] ?? STATUS_CONFIG.IDLE;
                      return (
                        <Card key={eng.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="pt-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold">{eng.name}</p>
                                <p className="text-xs text-muted-foreground">{eng.division} Division</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                                <Badge variant={cfg.variant} className="text-xs">
                                  {cfg.label}
                                </Badge>
                              </div>
                            </div>

                            {eng.activeProject ? (
                              <div className="rounded-lg bg-muted px-3 py-2">
                                <p className="text-xs text-muted-foreground">Current Project</p>
                                <Link href={`/projects/${eng.activeProject.id}`}>
                                  <p className="text-sm font-medium hover:underline truncate">
                                    {eng.activeProject.title}
                                  </p>
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                  {eng.activeProject.client.name}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-muted px-3 py-2">
                                <p className="text-xs text-muted-foreground">No active project</p>
                              </div>
                            )}

                            {eng.email && (
                              <p className="text-xs text-muted-foreground truncate">{eng.email}</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
