"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, AlertTriangle, Info, CreditCard, FileText } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  COMPLIANCE_EXPIRY: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  PAYMENT_REMINDER: <CreditCard className="h-4 w-4 text-blue-500" />,
  INVOICE_APPROVED: <FileText className="h-4 w-4 text-green-500" />,
  EXPENSE_SUBMITTED: <FileText className="h-4 w-4 text-slate-500" />,
  DEFAULT: <Info className="h-4 w-4 text-slate-500" />,
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "All notifications marked as read" });
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="brand" className="text-xs">{unreadCount} new</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">System alerts and updates</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(n => <Skeleton key={n} className="h-20 w-full" />)}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Bell className="h-12 w-12 opacity-30" />
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`cursor-pointer hover:shadow-sm transition-shadow ${
                !notif.isRead ? "border-primary/30 bg-primary/5" : ""
              }`}
              onClick={() => !notif.isRead && markRead.mutate(notif.id)}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {TYPE_ICON[notif.type] ?? TYPE_ICON.DEFAULT}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                        {notif.title}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(notif.createdAt), "dd MMM, HH:mm")}
                        </p>
                        {!notif.isRead && (
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                    {notif.link && (
                      <a
                        href={notif.link}
                        className="text-xs text-primary underline mt-1 inline-block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
