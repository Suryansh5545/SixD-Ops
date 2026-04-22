/**
 * Global TypeScript types and enums for SixD Ops Tool.
 * These are the application-level types used across frontend and API routes.
 * Prisma-generated types are re-exported where useful.
 */

import type {
  Role,
  Division,
  EngineerLevel,
  DocumentType,
  InvoiceType,
  InvoiceBillingLine,
  ProjectStatus,
  InvoiceStatus,
  DailyStatus,
  ExpenseCategory,
  PaymentTerms,
  IndustrySector,
  DeploymentStatus,
  ComplianceDocStatus,
} from "@prisma/client";

// ─── RE-EXPORTS ───────────────────────────────────────────────────────────────

export type {
  Role,
  Division,
  EngineerLevel,
  DocumentType,
  InvoiceType,
  InvoiceBillingLine,
  ProjectStatus,
  InvoiceStatus,
  DailyStatus,
  ExpenseCategory,
  PaymentTerms,
  IndustrySector,
  DeploymentStatus,
  ComplianceDocStatus,
};

// ─── SESSION & AUTH ───────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  roles: Role[];
  permissionGrants: string[];
  permissionRevokes: string[];
  isActive: boolean;
}

// ─── API RESPONSE WRAPPER ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ─── USER ─────────────────────────────────────────────────────────────────────

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  roles: Role[];
  isActive: boolean;
}

// ─── ENGINEER ────────────────────────────────────────────────────────────────

export interface EngineerWithUser {
  id: string;
  userId: string;
  division: Division;
  level: EngineerLevel;
  currentStatus: DailyStatus | null;
  currentProjectId: string | null;
  user: UserSummary;
}

// ─── CLIENT ───────────────────────────────────────────────────────────────────

export interface ClientSummary {
  id: string;
  name: string;
  sector: IndustrySector;
  paymentTermsDefault: PaymentTerms;
  gstPercent: number;
  portalType: string | null;
}

// ─── PURCHASE ORDER ───────────────────────────────────────────────────────────

export interface POSummary {
  id: string;
  internalId: string;
  clientId: string;
  client: ClientSummary;
  documentType: DocumentType;
  referenceNumber: string;
  amount: string; // Decimal serialised as string
  expiryDate: string; // ISO date string
  expectedWorkingDays: number;
  paymentTerms: PaymentTerms;
  customPaymentDays: number | null;
  invoiceType: InvoiceType;
  assignedPMId: string;
  assignedPM: UserSummary;
  workStartDate: string | null;
  remainingValue: string;
  notes: string | null;
  createdAt: string;
}

// ─── PROJECT ──────────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  division: Division | null;
  daysAuthorised: number;
  daysConsumed: number;
  isBlocked: boolean;
  standbyHoursTotal: number;
  startDate: string | null;
  endDate: string | null;
  siteLocation: string | null;
  createdAt: string;
  updatedAt: string;
  po: POSummary;
  client: ClientSummary;
  pm: UserSummary;
}

// ─── LOG SHEET ────────────────────────────────────────────────────────────────

export interface LogSheetEntryData {
  id: string;
  projectId: string;
  engineerId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  totalHours: number;
  extraHours: number;
  dailyStatus: DailyStatus;
  progressRemarks: string | null;
  reportStatus: string | null;
  clientCountersignatureUrl: string | null;
  createdAt: string;
  engineer: {
    id: string;
    division: Division;
    level: EngineerLevel;
    user: { id: string; name: string };
  };
}

// ─── EXPENSE ──────────────────────────────────────────────────────────────────

export interface ExpenseClaimData {
  id: string;
  projectId: string;
  engineerId: string;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  receiptUrl: string | null;
  approvedByPM: boolean;
  rejectedByPM: boolean;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  engineer: {
    id: string;
    user: { id: string; name: string };
  };
}

// ─── INVOICE ──────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  type: InvoiceBillingLine;
}

export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  projectId: string;
  poId: string;
  invoiceDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: string;
  gstPercent: number;
  gstAmount: string;
  totalAmount: string;
  status: InvoiceStatus;
  sentDate: string | null;
  sentMethod: string | null;
  workingSheetUrl: string | null;
  dueDate: string | null;
  balanceDue: string;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectSummary;
  createdBy: UserSummary;
}

// ─── COMPLIANCE ───────────────────────────────────────────────────────────────

export interface ComplianceDocTypeData {
  id: string;
  name: string;
  description: string | null;
  renewalFrequencyDays: number | null;
  isMandatory: boolean;
}

export interface ComplianceDocumentData {
  id: string;
  clientId: string;
  docTypeId: string;
  validFrom: string;
  expiryDate: string;
  fileUrl: string;
  status: ComplianceDocStatus;
  notes: string | null;
  createdAt: string;
  client: ClientSummary;
  docType: ComplianceDocTypeData;
  uploadedBy: UserSummary;
}

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────

export interface NotificationData {
  id: string;
  userId: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string | null;
  oldValue: unknown;
  newValue: unknown;
  timestamp: string;
  performedBy: UserSummary;
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

export interface MDDashboardStats {
  activeProjects: number;
  totalInvoicedMonth: number;
  totalCollectedMonth: number;
  overdueReceivables: number;
  teamOnSite: number;
  posExpiringIn30Days: number;
}

export interface CFOReceivablesAgeing {
  bucket0to30: number;
  bucket31to60: number;
  bucket60plus: number;
  total: number;
}

// ─── DEPLOYMENT ───────────────────────────────────────────────────────────────

export interface DeploymentData {
  id: string;
  projectId: string;
  engineerId: string;
  role: string;
  startDate: string;
  endDate: string | null;
  status: DeploymentStatus;
  equipment: {
    id: string;
    name: string;
    serialNumber: string;
  } | null;
  engineer: {
    id: string;
    division: Division;
    level: EngineerLevel;
    user: { id: string; name: string };
  };
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PO_RECEIVED: "PO Received",
  PO_MAPPED: "PO Mapped",
  CLIENT_CONFIRMATION_PENDING: "Client Confirmation Pending",
  PLANNING_TEAM: "Planning – Team",
  PLANNING_TRAVEL: "Planning – Travel",
  MOBILISED_IN_TRANSIT: "Mobilised – In Transit",
  ON_SITE_ACTIVE: "On Site – Active",
  ON_SITE_BLOCKED: "On Site – Blocked",
  WORK_COMPLETED: "Work Completed",
  MOM_CREATED: "MOM Created",
  REPORT_SUBMITTED: "Report Submitted",
  EXPENSES_RECEIVED: "Expenses Received",
  INVOICE_INITIATED: "Invoice Initiated",
  INVOICE_UNDER_REVIEW: "Invoice Under Review",
  INVOICE_SENT: "Invoice Sent",
  PAYMENT_PENDING: "Payment Pending",
  PARTIALLY_PAID: "Partially Paid",
  PAYMENT_RECEIVED: "Payment Received",
};

export const DAILY_STATUS_LABELS: Record<DailyStatus, string> = {
  TRAVELLING_TO_SITE: "Travelling to Site",
  SITE_WAITING: "Site Waiting",
  WORKING_ON_JOB: "Working on Job",
  TRAVELLING_BACK: "Travelling Back",
  RESTING_AT_HOME: "Resting at Home",
  ON_LEAVE: "On Leave",
  STANDBY_BLOCKED: "Standby / Blocked",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRAVEL_FLIGHT: "Travel – Flight",
  TRAVEL_TRAIN: "Travel – Train",
  TRAVEL_CAB: "Travel – Cab",
  HOTEL: "Hotel",
  DAILY_ALLOWANCE: "Daily Allowance",
  EQUIPMENT_MOBILISATION: "Equipment Mobilisation",
  STANDBY_CHARGES: "Standby Charges",
  EXTRA_HOURS: "Extra Hours",
  MISCELLANEOUS: "Miscellaneous",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
};

export const ROLE_LABELS: Record<Role, string> = {
  MD: "Managing Director",
  CFO: "CFO",
  BUSINESS_HEAD: "Business Head",
  ACCOUNTS: "Accounts",
  BD_TEAM: "BD Team",
  BUSINESS_MANAGER: "Business Manager",
  SALES_TEAM: "Sales Team",
  FIELD_ENGINEER: "Field Engineer",
};

export const STANDARD_SHIFT_HOURS = 8; // Hours per day before extra hours kick in
