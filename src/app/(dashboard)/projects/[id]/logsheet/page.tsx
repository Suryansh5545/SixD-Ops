"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClockInOutButton } from "@/components/logsheet/ClockInOutButton";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { formatINR } from "@/lib/utils/currency";
import { useAuth } from "@/hooks/useAuth";

interface LogEntry {
  id: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  totalHours?: number;
  extraHours?: number;
  dailyStatus: string;
  notes?: string;
  engineer: { id: string; name: string };
}

interface ProjectMeta {
  id: string;
  projectId: string;
  title: string;
  status: string;
  dailyRate: number;
  daysConsumed: number;
  expectedWorkingDays: number;
}

const DAILY_STATUS_LABELS: Record<string, string> = {
  WORKING: "Working",
  STANDBY: "Standby",
  TRAVEL: "Travel",
  HOLIDAY: "Holiday",
  SICK: "Sick Leave",
};

export default function LogsheetPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: project } = useQuery<ProjectMeta>({
    queryKey: ["project-meta", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: entries, isLoading } = useQuery<LogEntry[]>({
    queryKey: ["logsheet", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/logsheet`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const today = entries?.find(
    (e) => e.date === format(new Date(), "yyyy-MM-dd") && e.engineer?.id === user?.id
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <OfflineBanner />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Log Sheet</h1>
          {project && (
            <p className="text-sm text-muted-foreground">
              {project.title} · {project.projectId}
            </p>
          )}
        </div>
      </div>

      {/* Daily Rate info */}
      {project && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Daily Rate</p>
              <p className="font-bold">{formatINR(project.dailyRate)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Days Done</p>
              <p className="font-bold">{project.daysConsumed} / {project.expectedWorkingDays}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={project.status === "WORK_IN_PROGRESS" ? "success" : "muted"} className="mt-0.5">
                {project.status.replace(/_/g, " ")}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Clock In/Out — mobile-first large button */}
      <ClockInOutButton
        projectId={id}
        existingEntry={today ? {
          id: today.id,
          clockIn: today.clockIn,
          clockOut: today.clockOut,
          dailyStatus: today.dailyStatus as never,
        } : undefined}
      />

      {/* Log history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Log History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => <Skeleton key={n} className="h-14 w-full" />)}
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No log entries yet. Clock in to start.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {format(new Date(entry.date), "dd MMM yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.engineer.name}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground">
                      <p>In: {format(new Date(entry.clockIn), "HH:mm")}</p>
                      {entry.clockOut && (
                        <p>Out: {format(new Date(entry.clockOut), "HH:mm")}</p>
                      )}
                    </div>

                    <div className="text-right">
                      {entry.totalHours != null && (
                        <p className="text-sm font-medium">{entry.totalHours.toFixed(1)}h</p>
                      )}
                      {entry.extraHours != null && entry.extraHours > 0 && (
                        <p className="text-xs text-amber-600">+{entry.extraHours.toFixed(1)}h OT</p>
                      )}
                    </div>

                    <Badge
                      variant={
                        entry.dailyStatus === "WORKING" ? "success"
                          : entry.dailyStatus === "STANDBY" ? "warning"
                          : "muted"
                      }
                      className="text-xs"
                    >
                      {DAILY_STATUS_LABELS[entry.dailyStatus] ?? entry.dailyStatus}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
