"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Users,
  Receipt,
  Wallet,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: null, // Everyone sees a dashboard
  },
  {
    label: "Purchase Orders",
    href: "/pos",
    icon: FileText,
    permission: "po:view_all" as const,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderOpen,
    permission: null,
  },
  {
    label: "Team",
    href: "/team",
    icon: Users,
    permission: "team:view_all" as const,
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: Receipt,
    permission: "invoice:view_all" as const,
  },
  {
    label: "Payments",
    href: "/payments",
    icon: Wallet,
    permission: "payment:view" as const,
  },
  {
    label: "Compliance",
    href: "/compliance",
    icon: ShieldCheck,
    permission: "compliance:view" as const,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "settings:view" as const,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRoles = (session?.user?.roles ?? []) as Role[];
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen bg-card border-r transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <div>
            <div className="text-brand-500 font-bold text-lg leading-none">SixD</div>
            <div className="text-muted-foreground text-xs">Ops Tool</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          if (item.permission && !hasPermission(userRoles, item.permission)) return null;

          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "nav-item",
                isActive && "active",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User info at bottom */}
      {!collapsed && session?.user && (
        <div className="p-4 border-t">
          <p className="text-sm font-medium truncate">{session.user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
        </div>
      )}
    </aside>
  );
}
