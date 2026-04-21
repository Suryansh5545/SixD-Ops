/**
 * Client-side providers wrapper.
 * React Query, SessionProvider, Toaster, theme toggle.
 */

"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { OfflineBanner } from "@/components/shared/OfflineBanner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <OfflineBanner />
        {children}
        <Toaster />
      </QueryClientProvider>
    </SessionProvider>
  );
}
