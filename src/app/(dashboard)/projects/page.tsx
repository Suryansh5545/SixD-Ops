"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { PODayCounter } from "@/components/projects/PODayCounter";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { PROJECT_STATUS_LABELS } from "@/types";
import type { ProjectStatus } from "@prisma/client";

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["projects", { search, status, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      const res = await fetch(`/api/projects?${params}`);
      const json = await res.json();
      return json.data;
    },
    placeholderData: (prev) => prev,
  });

  const projects = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <RoleGuard permission="project:create">
          <Button asChild className="bg-brand-500 hover:bg-brand-600">
            <Link href="/projects/new">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Link>
          </Button>
        </RoleGuard>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, clients, PO..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium mb-1">No projects found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((proj: {
            id: string;
            name: string;
            status: ProjectStatus;
            client: { name: string };
            pm: { name: string };
            po: { internalId: string; expiryDate: string };
            daysConsumed: number;
            daysAuthorised: number;
            isBlocked: boolean;
            updatedAt: string;
            division: string | null;
          }) => (
            <Link
              key={proj.id}
              href={`/projects/${proj.id}`}
              className="block rounded-xl border bg-card p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{proj.name}</span>
                    {proj.isBlocked && (
                      <Badge variant="destructive" className="text-xs">BLOCKED</Badge>
                    )}
                    {proj.division && (
                      <Badge variant="secondary" className="text-xs">{proj.division}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {proj.client.name} · PM: {proj.pm.name} · {proj.po.internalId}
                  </p>
                  <p className="text-xs text-muted-foreground">Updated {formatDate(proj.updatedAt)}</p>
                </div>
                <ProjectStatusBadge status={proj.status} className="shrink-0" />
              </div>
              <PODayCounter daysConsumed={proj.daysConsumed} daysAuthorised={proj.daysAuthorised} />
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
