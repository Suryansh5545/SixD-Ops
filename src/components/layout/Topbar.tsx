"use client";

import { Bell, Search, LogOut, Moon, Sun } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import type { NotificationData } from "@/types";

export function Topbar() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useState(false);

  // Dark mode toggle
  useEffect(() => {
    const saved = localStorage.getItem("darkMode") === "true";
    setDarkMode(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  // Notifications — poll every 30 seconds
  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=10");
      const json = await res.json();
      return json.data as { notifications: NotificationData[]; unreadCount: number };
    },
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (ids?: string[]) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { markAllRead: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = notifData?.unreadCount ?? 0;

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4">
      {/* Global search hint */}
      <div className="hidden md:flex items-center gap-2 text-muted-foreground text-sm bg-muted rounded-lg px-3 py-1.5 cursor-pointer hover:bg-accent">
        <Search className="h-4 w-4" />
        <span>Search… (Ctrl+K)</span>
      </div>

      <div className="flex-1 md:flex-none" />

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notification bell */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-brand-500"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="font-semibold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  className="text-xs text-brand-500 hover:underline"
                  onClick={() => markReadMutation.mutate(undefined)}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!notifData?.notifications.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No notifications yet
                </p>
              ) : (
                notifData.notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 border-b last:border-0 hover:bg-accent cursor-pointer ${
                      !n.isRead ? "bg-accent/40" : ""
                    }`}
                    onClick={() => {
                      markReadMutation.mutate([n.id]);
                      if (n.link) window.location.href = n.link;
                    }}
                  >
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(n.createdAt, "dd MMM, hh:mm a")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-sm">
              <div className="h-7 w-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold">
                {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <span className="hidden md:block">{session?.user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
