"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Moon, Sun, Lock, Bell, User, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Required"),
  newPassword: z.string().min(8, "Min 8 characters"),
  confirmPassword: z.string().min(1, "Required"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const pinSchema = z.object({
  currentPin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/),
  newPin: z.string().length(6, "PIN must be 6 digits").regex(/^\d+$/),
  confirmPin: z.string().length(6),
}).refine((d) => d.newPin === d.confirmPin, {
  message: "PINs do not match",
  path: ["confirmPin"],
});

type PasswordForm = z.infer<typeof passwordSchema>;
type PinForm = z.infer<typeof pinSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setDarkMode(!darkMode);
    localStorage.setItem("theme", !darkMode ? "dark" : "light");
  };

  const pwForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const pinForm = useForm<PinForm>({ resolver: zodResolver(pinSchema) });

  const [pwLoading, setPwLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);

  const onPasswordChange = async (data: PasswordForm) => {
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast({ title: "Password updated" });
      pwForm.reset();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
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
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast({ title: "PIN updated" });
      pinForm.reset();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{user?.role?.toString().replace(/_/g, " ").toLowerCase() ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Adjust the visual theme of the app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <div>
                <p className="font-medium text-sm">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Currently {darkMode ? "dark" : "light"}</p>
              </div>
            </div>
            <button
              onClick={toggleDark}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? "bg-primary" : "bg-secondary"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  darkMode ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={pwForm.handleSubmit(onPasswordChange)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input type="password" {...pwForm.register("currentPassword")} />
              {pwForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">{pwForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" {...pwForm.register("newPassword")} />
              {pwForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">{pwForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" {...pwForm.register("confirmPassword")} />
              {pwForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{pwForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" variant="outline" loading={pwLoading}>
              <Save className="h-4 w-4" />
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change PIN (for field engineers) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Change 6-Digit PIN
          </CardTitle>
          <CardDescription>For field clock-in / clock-out on shared devices</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={pinForm.handleSubmit(onPinChange)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current PIN</Label>
              <Input
                type="password"
                maxLength={6}
                inputMode="numeric"
                className="tracking-[0.5em] text-center text-lg w-40"
                {...pinForm.register("currentPin")}
              />
              {pinForm.formState.errors.currentPin && (
                <p className="text-xs text-destructive">{pinForm.formState.errors.currentPin.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>New PIN</Label>
              <Input
                type="password"
                maxLength={6}
                inputMode="numeric"
                className="tracking-[0.5em] text-center text-lg w-40"
                {...pinForm.register("newPin")}
              />
              {pinForm.formState.errors.newPin && (
                <p className="text-xs text-destructive">{pinForm.formState.errors.newPin.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New PIN</Label>
              <Input
                type="password"
                maxLength={6}
                inputMode="numeric"
                className="tracking-[0.5em] text-center text-lg w-40"
                {...pinForm.register("confirmPin")}
              />
              {pinForm.formState.errors.confirmPin && (
                <p className="text-xs text-destructive">{pinForm.formState.errors.confirmPin.message}</p>
              )}
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
