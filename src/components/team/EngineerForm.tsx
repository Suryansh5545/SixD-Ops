"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Save, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const engineerFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  division: z.enum(["TS", "LSS"]),
  level: z.enum(["HEAD", "LEADER", "FIELD"]),
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.length >= 6, "Password must be at least 6 characters"),
  pin: z
    .string()
    .optional()
    .refine((value) => !value || /^\d{6}$/.test(value), "PIN must be 6 digits"),
  isActive: z.boolean().default(true),
  sendInvite: z.boolean().default(false),
});

export type EngineerFormValues = z.infer<typeof engineerFormSchema>;

interface EngineerFormProps {
  cancelHref: string;
  initialValues?: Partial<EngineerFormValues>;
  isSubmitting?: boolean;
  mode: "create" | "edit";
  onSubmit: (values: EngineerFormValues) => Promise<void>;
}

const selectClasses =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function EngineerForm({
  cancelHref,
  initialValues,
  isSubmitting,
  mode,
  onSubmit,
}: EngineerFormProps) {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<EngineerFormValues>({
    resolver: zodResolver(engineerFormSchema),
    defaultValues: {
      division: "TS",
      level: "FIELD",
      isActive: true,
      sendInvite: mode === "edit" ? false : true,
      ...initialValues,
    },
  });

  const isCreate = mode === "create";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Member Details
          </CardTitle>
          <CardDescription>
            {isCreate
              ? "Add a new field team member to the operations workspace."
              : "Update profile, access, and division details for this member."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="Enter full name" {...register("name")} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="name@company.com" {...register("email")} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="division">Division</Label>
            <select id="division" className={selectClasses} {...register("division")}>
              <option value="TS">TS</option>
              <option value="LSS">LS&S</option>
            </select>
            {errors.division ? <p className="text-xs text-destructive">{errors.division.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="level">Level</Label>
            <select id="level" className={selectClasses} {...register("level")}>
              <option value="HEAD">Head</option>
              <option value="LEADER">Leader</option>
              <option value="FIELD">Field Engineer</option>
            </select>
            {errors.level ? <p className="text-xs text-destructive">{errors.level.message}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Access Setup
          </CardTitle>
          <CardDescription>
            {isCreate
              ? "Leave password and PIN blank to use the default onboarding credentials."
              : "Leave password and PIN blank to keep the current credentials unchanged."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password">{isCreate ? "Temporary Password" : "Reset Password"}</Label>
            <Input
              id="password"
              type="password"
              placeholder={isCreate ? "Default: SixD@2024" : "Only fill to reset"}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">{isCreate ? "Temporary PIN" : "Reset PIN"}</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder={isCreate ? "Default: 123456" : "Only fill to reset"}
              {...register("pin")}
            />
            {errors.pin ? <p className="text-xs text-destructive">{errors.pin.message}</p> : null}
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 sm:col-span-2">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-primary" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Invitation email</p>
                <p className="text-sm text-muted-foreground">
                  {isCreate
                    ? "A join email with login details will be sent automatically after the member is created."
                    : "Optionally resend a join email after saving if the member needs fresh access instructions."}
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border p-4 sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded" {...register("isActive")} />
            <div>
              <p className="text-sm font-medium">Account is active</p>
              <p className="text-xs text-muted-foreground">
                Inactive members will remain in records but will not be able to sign in.
              </p>
            </div>
          </label>

          {!isCreate ? (
            <label className="flex items-center gap-3 rounded-xl border p-4 sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 rounded" {...register("sendInvite")} />
              <div>
                <p className="text-sm font-medium">Resend invitation email after saving</p>
                <p className="text-xs text-muted-foreground">
                  Useful when login details changed or the member needs a fresh invite.
                </p>
              </div>
            </label>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild type="button" variant="outline">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" variant="brand" loading={isSubmitting}>
          <Save className="h-4 w-4" />
          {isCreate ? "Create Team Member" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
