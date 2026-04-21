import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@prisma/client";
import { PROJECT_STATUS_LABELS } from "@/types";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  PO_RECEIVED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  PO_MAPPED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CLIENT_CONFIRMATION_PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  PLANNING_TEAM: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  PLANNING_TRAVEL: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  MOBILISED_IN_TRANSIT: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  ON_SITE_ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  ON_SITE_BLOCKED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  WORK_COMPLETED: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  MOM_CREATED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  REPORT_SUBMITTED: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  EXPENSES_RECEIVED: "bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300",
  INVOICE_INITIATED: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  INVOICE_UNDER_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  INVOICE_SENT: "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300",
  PAYMENT_PENDING: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  PARTIALLY_PAID: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  PAYMENT_RECEIVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <span
      className={cn(
        "status-badge whitespace-nowrap",
        STATUS_STYLES[status],
        className
      )}
    >
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
