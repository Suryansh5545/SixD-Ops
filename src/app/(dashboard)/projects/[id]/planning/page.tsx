"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, UserPlus, Wrench, X } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

interface Engineer {
  id: string;
  name: string;
  division: string;
  currentStatus: string;
  available: boolean;
  conflictProject?: string;
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  serialNumber?: string;
  available: boolean;
  conflictProject?: string;
}

interface TeamAssignment {
  engineerId?: string;
  equipmentId?: string;
  startDate: string;
  endDate: string;
  role?: string;
}

export default function TeamPlanningPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [assignEngineer, setAssignEngineer] = useState<{ id: string; name: string } | null>(null);
  const [assignEquipment, setAssignEquipment] = useState<{ id: string; name: string } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);

  const { data: engineers, isLoading: engLoading } = useQuery<Engineer[]>({
    queryKey: ["engineers-available"],
    queryFn: async () => {
      const res = await fetch("/api/engineers?includeAvailability=true");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: equipment, isLoading: eqLoading } = useQuery<Equipment[]>({
    queryKey: ["equipment-available"],
    queryFn: async () => {
      const res = await fetch("/api/engineers?type=equipment&includeAvailability=true");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: currentTeam } = useQuery<{ engineers: Engineer[]; equipment: Equipment[] }>({
    queryKey: ["project-team", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/team`);
      if (!res.ok) return { engineers: [], equipment: [] };
      return res.json();
    },
  });

  const assign = useMutation({
    mutationFn: async (payload: TeamAssignment) => {
      const res = await fetch(`/api/projects/${id}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign");
      if (data.conflicts?.length) {
        setConflicts(data.conflicts);
        throw new Error("Conflicts detected");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-team", id] });
      queryClient.invalidateQueries({ queryKey: ["engineers-available"] });
      toast({ title: "Team updated", description: "Assignment saved successfully" });
      setAssignEngineer(null);
      setAssignEquipment(null);
      setConflicts([]);
    },
    onError: (err: Error) => {
      if (err.message !== "Conflicts detected") {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  const handleAssign = () => {
    if (!startDate || !endDate) {
      toast({ title: "Missing dates", description: "Select start and end dates", variant: "destructive" });
      return;
    }

    const payload: TeamAssignment = {
      startDate,
      endDate,
      ...(assignEngineer ? { engineerId: assignEngineer.id } : {}),
      ...(assignEquipment ? { equipmentId: assignEquipment.id } : {}),
    };

    assign.mutate(payload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Team Planning</h1>
          <p className="text-sm text-muted-foreground">Assign engineers and equipment to the project</p>
        </div>
      </div>

      {/* Conflict alert */}
      {conflicts.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Double-booking conflicts:</strong>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              {conflicts.map((c, i) => <li key={i} className="text-sm">{c}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Current Team */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Currently Assigned</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentTeam?.engineers.length === 0 && currentTeam?.equipment.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No one assigned yet</p>
            ) : (
              <>
                {currentTeam?.engineers.map((eng) => (
                  <div key={eng.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{eng.name}</p>
                      <p className="text-xs text-muted-foreground">{eng.division}</p>
                    </div>
                    <Badge variant={eng.currentStatus === "WORKING" ? "success" : "warning"}>
                      {eng.currentStatus}
                    </Badge>
                  </div>
                ))}
                {currentTeam?.equipment.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{eq.name}</p>
                      <p className="text-xs text-muted-foreground">{eq.type}</p>
                    </div>
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Assignment Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {assignEngineer && (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{assignEngineer.name}</p>
                  <p className="text-xs text-muted-foreground">Engineer selected</p>
                </div>
                <button onClick={() => setAssignEngineer(null)}>
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            )}

            {assignEquipment && (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{assignEquipment.name}</p>
                  <p className="text-xs text-muted-foreground">Equipment selected</p>
                </div>
                <button onClick={() => setAssignEquipment(null)}>
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            )}

            <Button
              variant="brand"
              className="w-full"
              disabled={(!assignEngineer && !assignEquipment) || !startDate || !endDate}
              loading={assign.isPending}
              onClick={handleAssign}
            >
              <UserPlus className="h-4 w-4" />
              Confirm Assignment
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Available Engineers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Engineers</CardTitle>
        </CardHeader>
        <CardContent>
          {engLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(n => <Skeleton key={n} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {engineers?.map((eng) => (
                <button
                  key={eng.id}
                  onClick={() => !eng.available ? null : setAssignEngineer({ id: eng.id, name: eng.name })}
                  disabled={!eng.available}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    eng.available
                      ? assignEngineer?.id === eng.id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{eng.name}</p>
                    <p className="text-xs text-muted-foreground">{eng.division}</p>
                    {!eng.available && eng.conflictProject && (
                      <p className="text-xs text-red-500">Busy: {eng.conflictProject}</p>
                    )}
                  </div>
                  <Badge variant={eng.available ? "success" : "muted"} className="text-xs">
                    {eng.available ? "Available" : "Busy"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Equipment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipment</CardTitle>
        </CardHeader>
        <CardContent>
          {eqLoading ? (
            <div className="space-y-2">
              {[1,2].map(n => <Skeleton key={n} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {equipment?.map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => !eq.available ? null : setAssignEquipment({ id: eq.id, name: eq.name })}
                  disabled={!eq.available}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    eq.available
                      ? assignEquipment?.id === eq.id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{eq.name}</p>
                    <p className="text-xs text-muted-foreground">{eq.type}</p>
                  </div>
                  <Badge variant={eq.available ? "success" : "muted"} className="text-xs">
                    {eq.available ? "Available" : "In Use"}
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
