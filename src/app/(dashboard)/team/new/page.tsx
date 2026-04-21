"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { EngineerForm, type EngineerFormValues } from "@/components/team/EngineerForm";

export default function NewTeamMemberPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: EngineerFormValues) => {
    setSubmitting(true);

    try {
      const res = await fetch("/api/engineers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          division: values.division,
          level: values.level,
          password: values.password || undefined,
          pin: values.pin || undefined,
          isActive: values.isActive,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to create team member");
      }

      toast({
        title: "Team member created",
        description: "The member was added successfully and a join email was queued.",
      });
      router.push("/team");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create team member",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Team Member</h1>
          <p className="text-sm text-muted-foreground">
            Create a field engineer account and send the join email automatically.
          </p>
        </div>
      </div>

      <EngineerForm
        cancelHref="/team"
        isSubmitting={submitting}
        mode="create"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
