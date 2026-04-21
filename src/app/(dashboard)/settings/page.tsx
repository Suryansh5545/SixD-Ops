"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, Moon, Save, ShieldCheck, Sun, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(8, "Min 8 characters"),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const pinSchema = z
  .object({
    currentPin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/),
    newPin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/),
    confirmPin: z.string().length(6),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;
type PinForm = z.infer<typeof pinSchema>;
type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
  localStorage.setItem("darkMode", String(theme === "dark"));
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [pwLoading, setPwLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const pwForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const pinForm = useForm<PinForm>({ resolver: zodResolver(pinSchema) });

  const roleLabel = useMemo(() => {
    if (!user?.role) return "Not set";
    return user.role.toString().replace(/_/g, " ").toLowerCase();
  }, [user?.role]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    toast({ title: `${nextTheme === "dark" ? "Dark" : "Light"} mode enabled` });
  };

  const onPasswordChange = async (data: PasswordForm) => {
    setPwLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update password");
      }

      toast({ title: "Password updated" });
      pwForm.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setPwLoading(false);
    }
  };

  const onPinChange = async (data: PinForm) => {
    setPinLoading(true);

    try {
      const res = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update PIN");
      }

      toast({ title: "PIN updated" });
      pinForm.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update PIN",
        variant: "destructive",
      });
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, access preferences, and secure login details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
          <CardDescription>Your current account information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
            <p className="mt-2 text-sm font-semibold">{user?.name ?? "Not set"}</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="mt-2 break-all text-sm font-semibold">{user?.email ?? "Not set"}</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
            <p className="mt-2 text-sm font-semibold capitalize">{roleLabel}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose how the dashboard should look on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-background shadow-sm">
                {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Currently using {theme === "dark" ? "dark mode" : "light mode"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              aria-pressed={theme === "dark"}
              className={`inline-flex h-12 w-24 items-center rounded-full border px-1.5 transition-colors ${
                theme === "dark" ? "bg-slate-900 text-white" : "bg-white text-slate-900"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform ${
                  theme === "dark" ? "translate-x-11" : "translate-x-0"
                }`}
              >
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Change Password
          </CardTitle>
          <CardDescription>Use a strong password with at least 8 characters</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={pwForm.handleSubmit(onPasswordChange)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" {...pwForm.register("currentPassword")} />
                {pwForm.formState.errors.currentPassword ? (
                  <p className="text-xs text-destructive">
                    {pwForm.formState.errors.currentPassword.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" {...pwForm.register("newPassword")} />
                {pwForm.formState.errors.newPassword ? (
                  <p className="text-xs text-destructive">{pwForm.formState.errors.newPassword.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" {...pwForm.register("confirmPassword")} />
              {pwForm.formState.errors.confirmPassword ? (
                <p className="text-xs text-destructive">
                  {pwForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            <Button type="submit" variant="outline" loading={pwLoading}>
              <Save className="h-4 w-4" />
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Change 6-Digit PIN
          </CardTitle>
          <CardDescription>Used by field engineers for shared-device sign-in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={pinForm.handleSubmit(onPinChange)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="currentPin">Current PIN</Label>
                <Input
                  id="currentPin"
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  className="text-center tracking-[0.35em]"
                  {...pinForm.register("currentPin")}
                />
                {pinForm.formState.errors.currentPin ? (
                  <p className="text-xs text-destructive">{pinForm.formState.errors.currentPin.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPin">New PIN</Label>
                <Input
                  id="newPin"
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  className="text-center tracking-[0.35em]"
                  {...pinForm.register("newPin")}
                />
                {pinForm.formState.errors.newPin ? (
                  <p className="text-xs text-destructive">{pinForm.formState.errors.newPin.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPin">Confirm PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  maxLength={6}
                  inputMode="numeric"
                  className="text-center tracking-[0.35em]"
                  {...pinForm.register("confirmPin")}
                />
                {pinForm.formState.errors.confirmPin ? (
                  <p className="text-xs text-destructive">{pinForm.formState.errors.confirmPin.message}</p>
                ) : null}
              </div>
            </div>

            <Button type="submit" variant="outline" loading={pinLoading}>
              <Save className="h-4 w-4" />
              Update PIN
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
