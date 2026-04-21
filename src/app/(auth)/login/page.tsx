"use client";

/**
 * Login page.
 *
 * Two login modes:
 *   1. Email + Password (default for most users)
 *   2. 6-digit PIN (faster access for field engineers)
 */

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
    <div className="grid w-full items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="hidden rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur lg:block">
        <div className="flex max-w-xl flex-col gap-8">
          <div className="inline-flex w-fit items-center gap-3 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-black text-white">
              6D
            </span>
            SixD Engineering Solutions
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
              Operations Platform
            </p>
            <h1 className="max-w-lg text-5xl font-black leading-[1.05] text-slate-950">
              Run projects, people, and payment flow from one place.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600">
              A cleaner control room for project managers, business heads, finance, and field engineers to stay aligned through every stage of execution.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-950">Live</p>
              <p className="mt-1 text-sm text-slate-600">Project and team visibility</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-950">Role-based</p>
              <p className="mt-1 text-sm text-slate-600">Dashboards for each function</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-950">Mobile ready</p>
              <p className="mt-1 text-sm text-slate-600">Fast access for field teams</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-slate-950 px-6 py-5 text-slate-100 shadow-2xl">
            <p className="text-sm font-semibold text-brand-300">Built for execution</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Track PO validity, invoices, compliance, staffing status, and site activity without bouncing between spreadsheets and calls.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center lg:hidden">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/25">
            <span className="text-2xl font-black tracking-tight text-white">6D</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">SixD Ops</h1>
          <p className="mt-2 text-sm text-slate-600">Operations platform for project and field teams.</p>
        </div>

        <Card className="overflow-hidden rounded-[2rem] border-white/80 bg-white/90 shadow-[0_32px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <CardHeader className="space-y-4 border-b border-slate-100 pb-6">
            <div className="hidden items-center gap-3 lg:flex">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/25">
                <span className="text-lg font-black tracking-tight text-white">6D</span>
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">SixD Ops</p>
                <p className="text-sm text-slate-500">Secure team access</p>
              </div>
            </div>

            <div className="space-y-2">
              <CardTitle className="text-3xl font-black tracking-tight text-slate-950">Sign in</CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                {loginMode === "password"
                  ? "Use your company email and password to access your role dashboard."
                  : "Field engineers can use their company email and 6-digit PIN for quicker mobile access."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => setLoginMode("password")}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  loginMode === "password"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setLoginMode("pin")}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                  loginMode === "pin"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                6-digit PIN
              </button>
            </div>

            {loginMode === "password" ? (
              <form onSubmit={emailForm.handleSubmit(handlePasswordLogin)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-800">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@sixdengineering.com"
                    autoComplete="email"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-500"
                    {...emailForm.register("email")}
                  />
                  {emailForm.formState.errors.email && (
                    <p className="text-xs font-medium text-destructive">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-800">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 pr-12 text-slate-950 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-500"
                      {...emailForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {emailForm.formState.errors.password && (
                    <p className="text-xs font-medium text-destructive">{emailForm.formState.errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-brand-500 text-base font-semibold text-white shadow-lg shadow-brand-500/25 transition-transform hover:-translate-y-0.5 hover:bg-brand-600"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            ) : (
              <form onSubmit={pinForm.handleSubmit(handlePINLogin)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="pin-email" className="text-sm font-semibold text-slate-800">
                    Email
                  </Label>
                  <Input
                    id="pin-email"
                    type="email"
                    placeholder="you@sixdengineering.com"
                    autoComplete="email"
                    className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 text-slate-950 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-brand-500"
                    {...pinForm.register("email")}
                  />
                  {pinForm.formState.errors.email && (
                    <p className="text-xs font-medium text-destructive">{pinForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pin" className="text-sm font-semibold text-slate-800">
                    6-digit PIN
                  </Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    className="h-14 rounded-xl border-slate-200 bg-slate-50 px-4 text-center font-mono text-2xl tracking-[0.45em] text-slate-950 placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-brand-500"
                    {...pinForm.register("pin")}
                  />
                  {pinForm.formState.errors.pin && (
                    <p className="text-xs font-medium text-destructive">{pinForm.formState.errors.pin.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="h-14 w-full rounded-xl bg-brand-500 text-base font-semibold text-white shadow-lg shadow-brand-500/25 transition-transform hover:-translate-y-0.5 hover:bg-brand-600"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  Sign in with PIN
                </Button>
              </form>
            )}

            <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand-700">
                Certified Operations System
              </p>
              <p className="mt-1 text-sm text-slate-600">
                SixD Engineering Solutions | ISO 9001:2015 Certified
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
