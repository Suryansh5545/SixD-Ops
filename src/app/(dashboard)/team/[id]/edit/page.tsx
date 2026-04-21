"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { EngineerForm, type EngineerFormValues } from "@/components/team/EngineerForm";

interface EngineerDetail {
  id: string;
  division: "TS" | "LSS";
  level: "HEAD" | "LEADER" | "FIELD";
  user: {
    name: string;
    email: string;
    isActive: boolean;
  };
}

export default function EditTeamMemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { data: engineer, isLoading, isError } = useQuery<EngineerDetail | null>({
    queryKey: ["team-member", id],
    queryFn: async () => {
      const res = await fetch(`/api/engineers/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success || !json?.data) return null;
      return json.data as EngineerDetail;
    },
  });

  const handleSubmit = async (values: EngineerFormValues) => {
    setSubmitting(true);

    try {
      const res = await fetch(`/api/engineers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          division: values.division,
          level: values.level,
          password: values.password || undefined,
          pin: values.pin || undefined,
          isActive: values.isActive,
          sendInvite: values.sendInvite,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to update team member");
      }

      toast({
        title: "Team member updated",
        description: values.sendInvite
          ? "Changes saved and a fresh invitation email was queued."
          : "Changes saved successfully.",
      });
      router.push("/team");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update team member",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !engineer) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-sm text-muted-foreground">Team member details are unavailable right now.</p>
          <Button asChild variant="outline">
            <Link href="/team">Back to Team</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Team Member</h1>
          <p className="text-sm text-muted-foreground">
            Update team access, role details, and onboarding settings.
          </p>
        </div>
      </div>

      <EngineerForm
        cancelHref="/team"
        initialValues={{
          name: engineer.user.name,
          email: engineer.user.email,
          division: engineer.division,
          level: engineer.level,
          isActive: engineer.user.isActive,
          sendInvite: false,
        }}
        isSubmitting={submitting}
        mode="edit"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
