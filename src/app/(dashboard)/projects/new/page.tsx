"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  title: z.string().min(3, "Title is required (min 3 chars)"),
  poId: z.string().min(1, "PO is required"),
  division: z.enum(["TS", "LSS"]),
  location: z.string().min(1, "Location is required"),
  plannedStartDate: z.string().min(1, "Start date is required"),
  plannedEndDate: z.string().min(1, "End date is required"),
  expectedWorkingDays: z.coerce.number().int().positive("Working days must be positive"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ProjectPOOption {
  id: string;
  internalId: string;
  client: { id: string; name: string };
  assignedPM: { id: string; name: string };
  remainingValue: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPOId = searchParams.get("poId") ?? "";
  const [submitting, setSubmitting] = useState(false);

  const { data: pos = [] } = useQuery<ProjectPOOption[]>({
    queryKey: ["pos-active"],
    queryFn: async () => {
      const res = await fetch("/api/pos?status=ACTIVE&limit=100", { cache: "no-store" });
      if (!res.ok) return [];

      const json = await res.json().catch(() => null);
      return Array.isArray(json?.data?.items) ? (json.data.items as ProjectPOOption[]) : [];
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      poId: preselectedPOId,
      division: "TS",
      expectedWorkingDays: 30,
    },
  });

  const selectedPOId = watch("poId");
  const selectedPO = pos.find((po) => po.id === selectedPOId);

  const onSubmit = async (values: FormValues) => {
    if (!selectedPO) {
      toast({
        title: "Select a valid PO",
        description: "Project creation needs an active purchase order.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        poId: values.poId,
        clientId: selectedPO.client.id,
        name: values.title,
        description: values.notes || null,
        division: values.division,
        pmId: selectedPO.assignedPM.id,
        startDate: values.plannedStartDate,
        endDate: values.plannedEndDate,
        daysAuthorised: values.expectedWorkingDays,
        siteLocation: values.location,
      };

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data) {
        throw new Error(json?.error || "Failed to create project");
      }

      toast({
        title: "Project created",
        description: `${json.data.name} was created successfully.`,
      });
      router.push("/projects");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Project</h1>
          <p className="text-sm text-muted-foreground">Create a project against an active PO</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Link to Purchase Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="poId">Purchase Order *</Label>
              <select
                id="poId"
                className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register("poId")}
              >
                <option value="">Select PO...</option>
                {pos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.internalId} - {po.client.name}
                  </option>
                ))}
              </select>
              {errors.poId && <p className="text-xs text-destructive">{errors.poId.message}</p>}
            </div>

            {selectedPO && (
              <div className="space-y-1 rounded-lg bg-muted px-4 py-3 text-sm">
                <p className="font-medium">{selectedPO.client.name}</p>
                <p className="text-muted-foreground">Assigned Business Manager: {selectedPO.assignedPM.name}</p>
                <p className="text-muted-foreground">Remaining value: {selectedPO.remainingValue}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Annual Maintenance Survey - Jamshedpur BF#5"
                {...register("title")}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="division">Division *</Label>
                <select
                  id="division"
                  className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  {...register("division")}
                >
                  <option value="TS">TS (Technical Services)</option>
                  <option value="LSS">LS&S</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location">Location *</Label>
                <Input id="location" placeholder="e.g. Jamshedpur, Jharkhand" {...register("location")} />
                {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expectedWorkingDays">Expected Working Days *</Label>
              <Input id="expectedWorkingDays" type="number" min={1} {...register("expectedWorkingDays")} />
              {errors.expectedWorkingDays && (
                <p className="text-xs text-destructive">{errors.expectedWorkingDays.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Planned Timeline</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="plannedStartDate">Planned Start *</Label>
              <Input id="plannedStartDate" type="date" {...register("plannedStartDate")} />
              {errors.plannedStartDate && (
                <p className="text-xs text-destructive">{errors.plannedStartDate.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plannedEndDate">Planned End *</Label>
              <Input id="plannedEndDate" type="date" {...register("plannedEndDate")} />
              {errors.plannedEndDate && (
                <p className="text-xs text-destructive">{errors.plannedEndDate.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea id="notes" rows={3} placeholder="Any pre-project notes or flags..." {...register("notes")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/projects">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="brand" loading={submitting}>
            <Plus className="h-4 w-4" />
            Create Project
          </Button>
        </div>
      </form>
    </div>
  );
}
