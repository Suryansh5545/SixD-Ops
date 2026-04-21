"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Home, ClipboardList, Bell, User } from "lucide-react";
import type { Role } from "@prisma/client";

/**
 * Bottom navigation bar for mobile field engineers.
 * Only shown on small screens.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isEngineer = (session?.user?.roles as Role[])?.includes("FIELD_ENGINEER");

  // Only show mobile bottom nav for field engineers
  if (!isEngineer) return null;

  const items = [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Log Today", href: "/projects", icon: ClipboardList },
    { label: "Alerts", href: "/notifications", icon: Bell },
    { label: "Profile", href: "/settings", icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around z-40">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors",
              isActive ? "text-brand-500" : "text-muted-foreground"
            )}
          >
            <item.icon className={cn("h-6 w-6", isActive && "text-brand-500")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
