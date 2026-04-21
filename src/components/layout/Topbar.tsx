"use client";

import { Bell, LogOut, Moon, Search, Sun } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import type { NotificationData } from "@/types";

export function Topbar() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    localStorage.setItem("darkMode", String(next));
  };

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
    <header className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4">
      <div className="hidden cursor-pointer items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent md:flex">
        <Search className="h-4 w-4" />
        <span>Search... (Ctrl+K)</span>
      </div>

      <div className="flex-1 md:flex-none" />

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 p-0 text-xs">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between border-b p-3">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 ? (
                <button
                  className="text-xs text-brand-500 hover:underline"
                  onClick={() => markReadMutation.mutate(undefined)}
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!notifData?.notifications.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No notifications yet</p>
              ) : (
                notifData.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`cursor-pointer border-b p-3 last:border-0 hover:bg-accent ${
                      !notification.isRead ? "bg-accent/40" : ""
                    }`}
                    onClick={() => {
                      markReadMutation.mutate([notification.id]);
                      if (notification.link) window.location.href = notification.link;
                    }}
                  >
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(notification.createdAt, "dd MMM, hh:mm a")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
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
            <DropdownMenuItem className="text-destructive" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
