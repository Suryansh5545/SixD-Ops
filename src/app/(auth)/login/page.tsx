"use client";

/**
 * Login page.
 *
 * Two login modes:
 *   1. Email + Password (default — all roles)
 *   2. 6-digit PIN (field engineer mode — shown when PIN toggle is selected)
 *
 * Field engineers typically arrive here from a bookmark or home screen shortcut.
 */

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const emailLoginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const pinLoginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  pin: z.string().length(6, "PIN must be exactly 6 digits").regex(/^\d+$/, "PIN must be numbers only"),
});

type EmailLoginForm = z.infer<typeof emailLoginSchema>;
type PINLoginForm = z.infer<typeof pinLoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const { toast } = useToast();

  const [loginMode, setLoginMode] = useState<"password" | "pin">("password");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailForm = useForm<EmailLoginForm>({
    resolver: zodResolver(emailLoginSchema),
  });

  const pinForm = useForm<PINLoginForm>({
    resolver: zodResolver(pinLoginSchema),
  });

  const handlePasswordLogin = async (data: EmailLoginForm) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        loginMode: "password",
        redirect: false,
      });

      if (result?.error) {
        toast({
          title: "Sign in failed",
          description: "Incorrect email or password. Please try again.",
          variant: "destructive",
        });
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePINLogin = async (data: PINLoginForm) => {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        pin: data.pin,
        loginMode: "pin",
        redirect: false,
      });

      if (result?.error) {
        toast({
          title: "Sign in failed",
          description: "Incorrect email or PIN. Please try again.",
          variant: "destructive",
        });
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm px-4">
      {/* Logo */}
      <div className="text-center mb-8">
        {/* SixD geometric mark — orange brand colour */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500 rounded-2xl mb-4">
          <span className="text-white font-black text-2xl tracking-tight">6D</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">SixD Ops</h1>
        <p className="text-sm text-muted-foreground mt-1">Engineering Solutions — Operations Platform</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Sign in</CardTitle>
          <CardDescription>
            {loginMode === "password"
              ? "Use your SixD email and password"
              : "Use your SixD email and 6-digit PIN"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Mode toggle */}
          <div className="flex rounded-lg bg-muted p-1 mb-6">
            <button
              type="button"
              onClick={() => setLoginMode("password")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                loginMode === "password"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setLoginMode("pin")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                loginMode === "pin"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              6-digit PIN
            </button>
          </div>

          {loginMode === "password" ? (
            <form onSubmit={emailForm.handleSubmit(handlePasswordLogin)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@sixdengineering.com"
                  autoComplete="email"
                  {...emailForm.register("email")}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{emailForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...emailForm.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {emailForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{emailForm.formState.errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full bg-brand-500 hover:bg-brand-600" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={pinForm.handleSubmit(handlePINLogin)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pin-email">Email</Label>
                <Input
                  id="pin-email"
                  type="email"
                  placeholder="you@sixdengineering.com"
                  autoComplete="email"
                  {...pinForm.register("email")}
                />
                {pinForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{pinForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pin">6-digit PIN</Label>
                <Input
                  id="pin"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  {...pinForm.register("pin")}
                />
                {pinForm.formState.errors.pin && (
                  <p className="text-xs text-destructive">{pinForm.formState.errors.pin.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-500 hover:bg-brand-600 text-lg py-6"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                Sign in with PIN
              </Button>
            </form>
          )}

          <p className="text-xs text-muted-foreground text-center mt-4">
            SixD Engineering Solutions · ISO 9001:2015 Certified
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
