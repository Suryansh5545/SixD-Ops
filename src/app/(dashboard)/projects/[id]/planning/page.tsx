"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, UserPlus, Wrench, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

interface EngineerOption {
  id: string;
  name: string;
  division: string;
  level: string;
  available: boolean;
  conflictProject?: string | null;
}

interface EquipmentOption {
  id: string;
  name: string;
  type: string;
  available: boolean;
  conflictProject?: string | null;
}

interface CurrentEngineer {
  id: string;
  name: string;
  division: string;
  currentStatus: string | null;
  role: string;
}

interface CurrentEquipment {
  id: string;
  name: string;
  type: string;
}

function getDefaultRole(level: string) {
  if (level === "HEAD" || level === "LEADER") return "Team Lead";
  return "Field Engineer";
}

export default function TeamPlanningPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [assignEngineer, setAssignEngineer] = useState<EngineerOption | null>(null);
  const [assignEquipment, setAssignEquipment] = useState<EquipmentOption | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);

  const availabilityQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (startDate) params.set("available", "true");
    return params.toString();
  }, [endDate, startDate]);

  const { data: engineers = [], isLoading: engLoading } = useQuery<EngineerOption[]>({
    queryKey: ["engineers-available", availabilityQuery],
    queryFn: async () => {
      const res = await fetch(`/api/engineers${availabilityQuery ? `?${availabilityQuery}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) return [];

      const json = await res.json().catch(() => null);
      const rows = Array.isArray(json?.data) ? json.data : [];
      return rows.map((engineer: {
        id: string;
        division: string;
        level: string;
        isAvailableForDates: boolean | null;
        isAvailableNow: boolean;
        conflictProject?: string | null;
        user: { name: string };
      }) => ({
        id: engineer.id,
        name: engineer.user.name,
        division: engineer.division,
        level: engineer.level,
        available: engineer.isAvailableForDates ?? engineer.isAvailableNow,
        conflictProject: engineer.conflictProject ?? null,
      }));
    },
  });

  const { data: equipment = [], isLoading: eqLoading } = useQuery<EquipmentOption[]>({
    queryKey: ["equipment-available", availabilityQuery],
    queryFn: async () => {
      const res = await fetch(`/api/equipment${availabilityQuery ? `?${availabilityQuery}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) return [];

      const json = await res.json().catch(() => null);
      return Array.isArray(json?.data) ? (json.data as EquipmentOption[]) : [];
    },
  });

  const { data: currentTeam = { engineers: [], equipment: [] } } = useQuery<{
    engineers: CurrentEngineer[];
    equipment: CurrentEquipment[];
  }>({
    queryKey: ["project-team", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/team`, { cache: "no-store" });
      if (!res.ok) return { engineers: [], equipment: [] };

      const json = await res.json().catch(() => null);
      return {
        engineers: Array.isArray(json?.data?.engineers) ? (json.data.engineers as CurrentEngineer[]) : [],
        equipment: Array.isArray(json?.data?.equipment) ? (json.data.equipment as CurrentEquipment[]) : [],
      };
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      if (!assignEngineer) {
        throw new Error("Select an engineer before assigning.");
      }

      const res = await fetch(`/api/projects/${id}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engineers: [
            {
              engineerId: assignEngineer.id,
              role: getDefaultRole(assignEngineer.level),
              startDate,
              endDate: endDate || null,
              equipmentId: assignEquipment?.id ?? null,
            },
          ],
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (Array.isArray(json?.conflicts)) {
          setConflicts(json.conflicts);
        }
        throw new Error(json?.error || "Failed to assign team");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-team", id] });
      queryClient.invalidateQueries({ queryKey: ["engineers-available"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-available"] });
      toast({ title: "Team updated", description: "Assignment saved successfully." });
      setAssignEngineer(null);
      setAssignEquipment(null);
      setConflicts([]);
    },
    onError: (error: Error) => {
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
    },
  });

  const handleAssign = () => {
    if (!assignEngineer) {
      toast({
        title: "Select an engineer",
        description: "A team assignment must include an engineer.",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Missing dates",
        description: "Select start and end dates before assigning the team.",
        variant: "destructive",
      });
      return;
    }

    assign.mutate();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Team Planning</h1>
          <p className="text-sm text-muted-foreground">Assign engineers and optional equipment to the project</p>
        </div>
      </div>

      {conflicts.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Scheduling conflicts detected:</strong>
            <div className="mt-2 space-y-1">
              {conflicts.map((conflict) => (
                <p key={conflict} className="text-sm">
                  {conflict}
                </p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Currently Assigned</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentTeam.engineers.length === 0 && currentTeam.equipment.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No team members assigned yet.</p>
            ) : (
              <>
                {currentTeam.engineers.map((engineer) => (
                  <div key={engineer.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{engineer.name}</p>
                      <p className="text-xs text-muted-foreground">{engineer.division}</p>
                    </div>
                    <Badge variant={engineer.currentStatus ? "brand" : "muted"}>{engineer.role}</Badge>
                  </div>
                ))}

                {currentTeam.equipment.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.type}</p>
                    </div>
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>

            {assignEngineer && (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{assignEngineer.name}</p>
                  <p className="text-xs text-muted-foreground">{getDefaultRole(assignEngineer.level)}</p>
                </div>
                <button type="button" onClick={() => setAssignEngineer(null)}>
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            )}

            {assignEquipment && (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{assignEquipment.name}</p>
                  <p className="text-xs text-muted-foreground">Optional equipment</p>
                </div>
                <button type="button" onClick={() => setAssignEquipment(null)}>
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            )}

            <Button
              variant="brand"
              className="w-full"
              disabled={!assignEngineer || !startDate || !endDate}
              loading={assign.isPending}
              onClick={handleAssign}
            >
              <UserPlus className="h-4 w-4" />
              Confirm Assignment
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Engineers</CardTitle>
        </CardHeader>
        <CardContent>
          {engLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : engineers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No engineers available for the selected dates.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {engineers.map((engineer) => (
                <button
                  key={engineer.id}
                  type="button"
                  onClick={() => engineer.available && setAssignEngineer(engineer)}
                  disabled={!engineer.available}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    engineer.available
                      ? assignEngineer?.id === engineer.id
                        ? "border-primary bg-primary/10"
                        : "cursor-pointer hover:bg-muted"
                      : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{engineer.name}</p>
                    <p className="text-xs text-muted-foreground">{engineer.division}</p>
                    {!engineer.available && engineer.conflictProject ? (
                      <p className="text-xs text-red-500">Busy: {engineer.conflictProject}</p>
                    ) : null}
                  </div>
                  <Badge variant={engineer.available ? "success" : "muted"} className="text-xs">
                    {engineer.available ? "Available" : "Busy"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipment</CardTitle>
        </CardHeader>
        <CardContent>
          {eqLoading ? (
            <div className="space-y-2">
              {[1, 2].map((item) => (
                <Skeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : equipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">No equipment is available for the selected dates.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {equipment.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => item.available && setAssignEquipment(item)}
                  disabled={!item.available}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    item.available
                      ? assignEquipment?.id === item.id
                        ? "border-primary bg-primary/10"
                        : "cursor-pointer hover:bg-muted"
                      : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                    {!item.available && item.conflictProject ? (
                      <p className="text-xs text-red-500">In use on {item.conflictProject}</p>
                    ) : null}
                  </div>
                  <Badge variant={item.available ? "success" : "muted"} className="text-xs">
                    {item.available ? "Available" : "In Use"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
