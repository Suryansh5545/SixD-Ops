"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Timer, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DAILY_STATUS_LABELS } from "@/types";
import type { DailyStatus } from "@prisma/client";
import { toIST } from "@/lib/utils/date";

interface ClockInOutButtonProps {
  projectId: string;
  existingEntry?: {
    id: string;
    clockIn: string | null;
    clockOut: string | null;
    dailyStatus: DailyStatus;
  } | null;
}

/**
 * Large mobile-optimised Clock In / Clock Out button.
 * Shows current status and elapsed time when clocked in.
 * Requires daily status selection on clock-in.
 */
export function ClockInOutButton({ projectId, existingEntry }: ClockInOutButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<DailyStatus>("WORKING_ON_JOB");
  const [remarks, setRemarks] = useState("");
  const [showStatusSelect, setShowStatusSelect] = useState(false);

  const isClockedIn = !!existingEntry?.clockIn && !existingEntry?.clockOut;
  const isClockedOut = !!existingEntry?.clockIn && !!existingEntry?.clockOut;

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/logsheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, dailyStatus: status, progressRemarks: remarks }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast({ title: "Clocked in!", description: `Status: ${DAILY_STATUS_LABELS[status]}` });
      queryClient.invalidateQueries({ queryKey: ["logsheet", projectId] });
      queryClient.invalidateQueries({ queryKey: ["today-entry", projectId] });
      setShowStatusSelect(false);
      setRemarks("");
    },
    onError: (err: Error) => {
      toast({ title: "Clock-in failed", description: err.message, variant: "destructive" });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/logsheet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, progressRemarks: remarks }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Clocked out!",
        description: `Total: ${data.totalHours.toFixed(2)} hrs${data.extraHours > 0 ? ` (${data.extraHours.toFixed(2)} extra)` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["logsheet", projectId] });
      queryClient.invalidateQueries({ queryKey: ["today-entry", projectId] });
      setRemarks("");
    },
    onError: (err: Error) => {
      toast({ title: "Clock-out failed", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = clockInMutation.isPending || clockOutMutation.isPending;

  // Already clocked out today
  if (isClockedOut) {
    return (
      <div className="rounded-2xl border-2 border-muted p-6 text-center space-y-2">
        <p className="text-lg font-semibold text-muted-foreground">Clocked out for today</p>
        <p className="text-sm text-muted-foreground">
          {toIST(existingEntry.clockIn!)} → {toIST(existingEntry.clockOut!)}
        </p>
      </div>
    );
  }

  // Clocked in — show clock out
  if (isClockedIn) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-green-50 dark:bg-green-950 border-2 border-green-200 p-4 text-center">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">On duty since</p>
          <p className="text-xl font-bold text-green-800 dark:text-green-200">
            {toIST(existingEntry.clockIn!)}
          </p>
          <p className="text-xs text-green-600 mt-1">{DAILY_STATUS_LABELS[existingEntry.dailyStatus]}</p>
        </div>

        <Textarea
          placeholder="Optional remarks before clocking out..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="text-base"
          rows={2}
        />

        <Button
          className="clock-btn bg-red-500 hover:bg-red-600 text-white w-full"
          onClick={() => clockOutMutation.mutate()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <TimerOff className="h-6 w-6 mr-3" />
              Clock Out
            </>
          )}
        </Button>
      </div>
    );
  }

  // Not clocked in yet
  if (showStatusSelect) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Daily Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as DailyStatus)}>
            <SelectTrigger className="text-base h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DAILY_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-base py-3">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          placeholder="Optional remarks..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="text-base"
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-14" onClick={() => setShowStatusSelect(false)}>
            Cancel
          </Button>
          <Button
            className="h-14 bg-green-500 hover:bg-green-600 text-white text-lg"
            onClick={() => clockInMutation.mutate()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      className="clock-btn bg-green-500 hover:bg-green-600 text-white w-full"
      onClick={() => setShowStatusSelect(true)}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <>
          <Timer className="h-6 w-6 mr-3" />
          Clock In
        </>
      )}
    </Button>
  );
}
