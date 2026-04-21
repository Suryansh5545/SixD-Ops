"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

interface EngineerApi {
  id: string;
  division: "TS" | "LSS";
  level: "HEAD" | "LEADER" | "FIELD";
  currentStatus: string | null;
  user: {
    name: string;
    email: string;
    isActive: boolean;
  };
  currentDeployment?: {
    project: {
      id: string;
      name: string;
      client: { name: string };
    };
  } | null;
}

interface EngineerCard {
  id: string;
  activeProject: {
    client: { name: string };
    id: string;
    title: string;
  } | null;
  division: "TS" | "LSS";
  email: string;
  isActive: boolean;
  level: "HEAD" | "LEADER" | "FIELD";
  name: string;
  statusKey: "WORKING" | "STANDBY" | "IDLE" | "ON_LEAVE";
}

const STATUS_CONFIG = {
  WORKING: { label: "Working", variant: "success" as const, dot: "bg-green-500" },
  STANDBY: { label: "Standby", variant: "warning" as const, dot: "bg-amber-500" },
  IDLE: { label: "Available", variant: "muted" as const, dot: "bg-slate-400" },
  ON_LEAVE: { label: "On Leave", variant: "info" as const, dot: "bg-blue-500" },
};

function mapStatus(status: string | null): EngineerCard["statusKey"] {
  if (status === "WORKING_ON_JOB" || status === "TRAVELLING_TO_SITE") return "WORKING";
  if (status === "STANDBY_BLOCKED" || status === "SITE_WAITING") return "STANDBY";
  if (status === "ON_LEAVE") return "ON_LEAVE";
  return "IDLE";
}

function normalizeEngineers(rows: EngineerApi[]): EngineerCard[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.user.name,
    email: row.user.email,
    division: row.division,
    level: row.level,
    isActive: row.user.isActive,
    statusKey: mapStatus(row.currentStatus),
    activeProject: row.currentDeployment?.project
      ? {
          id: row.currentDeployment.project.id,
          title: row.currentDeployment.project.name,
          client: row.currentDeployment.project.client,
        }
      : null,
  }));
}

function formatLevel(level: EngineerCard["level"]) {
  return level === "FIELD" ? "Field Engineer" : level.charAt(0) + level.slice(1).toLowerCase();
}

export default function TeamPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [division, setDivision] = useState<"ALL" | "TS" | "LSS">("ALL");

  const { data: engineers = [], isLoading, isError } = useQuery<EngineerCard[]>({
    queryKey: ["team-engineers"],
    queryFn: async () => {
      const res = await fetch("/api/engineers", { cache: "no-store" });
      if (!res.ok) return [];

      const json = await res.json().catch(() => null);
      const rows = Array.isArray(json?.data) ? (json.data as EngineerApi[]) : [];
      return normalizeEngineers(rows);
    },
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    return engineers.filter((engineer) => {
      const needle = search.trim().toLowerCase();
      const matchSearch =
        needle === "" ||
        engineer.name.toLowerCase().includes(needle) ||
        engineer.email.toLowerCase().includes(needle) ||
        engineer.activeProject?.title.toLowerCase().includes(needle);

      const matchDivision = division === "ALL" || engineer.division === division;
      return matchSearch && matchDivision;
    });
  }, [division, engineers, search]);

  const grouped = {
    TS: filtered.filter((engineer) => engineer.division === "TS"),
    LSS: filtered.filter((engineer) => engineer.division === "LSS"),
  };

  const stats = {
    total: engineers.length,
    working: engineers.filter((engineer) => engineer.statusKey === "WORKING").length,
    standby: engineers.filter((engineer) => engineer.statusKey === "STANDBY").length,
    idle: engineers.filter((engineer) => engineer.statusKey === "IDLE").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Field Team</h1>
          <p className="text-sm text-muted-foreground">
            Live view of engineer availability, current assignments, and team access.
          </p>
        </div>

        {can("team:manage") ? (
          <Button asChild variant="brand">
            <Link href="/team/new">
              <Plus className="h-4 w-4" />
              Add Member
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search engineers..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["ALL", "TS", "LSS"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setDivision(value)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                division === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {value === "ALL" ? "All" : value}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="ALL">
          <TabsList>
            <TabsTrigger value="ALL">All ({filtered.length})</TabsTrigger>
            <TabsTrigger value="TS">TS ({grouped.TS.length})</TabsTrigger>
            <TabsTrigger value="LSS">LS&S ({grouped.LSS.length})</TabsTrigger>
          </TabsList>

          {(["ALL", "TS", "LSS"] as const).map((tab) => {
            const list = tab === "ALL" ? filtered : grouped[tab];

            return (
              <TabsContent key={tab} value={tab}>
                {list.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    <p className="text-sm">
                      {isError ? "Team data is unavailable right now." : "No engineers match your filter."}
                    </p>
                    {can("team:manage") && !isError ? (
                      <Button asChild variant="outline" className="mt-4">
                        <Link href="/team/new">Create the first team member</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((engineer) => {
                      const config = STATUS_CONFIG[engineer.statusKey];

                      return (
                        <Card key={engineer.id} className="transition-shadow hover:shadow-md">
                          <CardContent className="space-y-4 pt-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold">{engineer.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {engineer.division} Division · {formatLevel(engineer.level)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className={`h-2 w-2 rounded-full ${config.dot}`} />
                                <Badge variant={config.variant} className="text-xs">
                                  {config.label}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge variant={engineer.isActive ? "success" : "muted"}>
                                {engineer.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>

                            {engineer.activeProject ? (
                              <div className="rounded-lg bg-muted px-3 py-2">
                                <p className="text-xs text-muted-foreground">Current Project</p>
                                <Link href={`/projects/${engineer.activeProject.id}`}>
                                  <p className="truncate text-sm font-medium hover:underline">
                                    {engineer.activeProject.title}
                                  </p>
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                  {engineer.activeProject.client.name}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-muted px-3 py-2">
                                <p className="text-xs text-muted-foreground">No active project</p>
                              </div>
                            )}

                            <p className="truncate text-xs text-muted-foreground">{engineer.email}</p>

                            {can("team:manage") ? (
                              <div className="flex justify-end">
                                <Button asChild variant="outline" size="sm">
                                  <Link href={`/team/${engineer.id}/edit`}>
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                  </Link>
                                </Button>
                              </div>
                            ) : null}
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
