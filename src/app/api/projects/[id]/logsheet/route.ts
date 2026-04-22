/**
 * GET  /api/projects/[id]/logsheet — All log entries for a project
 * POST /api/projects/[id]/logsheet — Clock in (creates today's log entry)
 * PUT  /api/projects/[id]/logsheet — Clock out (updates today's log entry)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getPermissionOverrides,
  guardRoute,
  sanitiseText,
} from "@/lib/utils/permissions";
import { ClockInSchema, ClockOutSchema } from "@/lib/validations/logsheet";
import { NotificationService } from "@/lib/services/NotificationService";
import { STANDARD_SHIFT_HOURS } from "@/types";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const entries = await prisma.logSheetEntry.findMany({
      where: { projectId: params.id },
      include: {
        engineer: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error("[GET /api/projects/:id/logsheet]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST — Clock in for today.
 * Creates a LogSheetEntry for today if none exists for this engineer on this project.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "logsheet:submit",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const body = await req.json();
    const parsed = ClockInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.progressRemarks) data.progressRemarks = sanitiseText(data.progressRemarks);

    // Find engineer record for this user
    const engineer = await prisma.engineer.findUnique({
      where: { userId: session.user.id },
    });

    if (!engineer) {
      return NextResponse.json({ success: false, error: "Engineer record not found" }, { status: 404 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const clockIn = new Date(); // Server-side UTC timestamp

    // Check if already clocked in today
    const existing = await prisma.logSheetEntry.findUnique({
      where: {
        projectId_engineerId_date: {
          projectId: params.id,
          engineerId: engineer.id,
          date: today,
        },
      },
    });

    if (existing?.clockIn) {
      return NextResponse.json(
        { success: false, error: "Already clocked in for today on this project" },
        { status: 409 }
      );
    }

    // Upsert today's entry (create if not exists, update if status was set manually)
    const entry = await prisma.$transaction(async (tx) => {
      const logEntry = await tx.logSheetEntry.upsert({
        where: {
          projectId_engineerId_date: {
            projectId: params.id,
            engineerId: engineer.id,
            date: today,
          },
        },
        update: { clockIn, dailyStatus: data.dailyStatus, progressRemarks: data.progressRemarks },
        create: {
          projectId: params.id,
          engineerId: engineer.id,
          date: today,
          clockIn,
          dailyStatus: data.dailyStatus,
          progressRemarks: data.progressRemarks,
        },
      });

      // Update engineer's current status
      await tx.engineer.update({
        where: { id: engineer.id },
        data: {
          currentStatus: data.dailyStatus,
          currentProjectId: params.id,
        },
      });

      // If STANDBY_BLOCKED, mark project as blocked
      if (data.dailyStatus === "STANDBY_BLOCKED") {
        const proj = await tx.project.findUnique({ where: { id: params.id } });
        if (!proj?.isBlocked) {
          await tx.project.update({
            where: { id: params.id },
            data: { isBlocked: true, blockedSince: new Date(), status: "ON_SITE_BLOCKED" },
          });

          // Notify PM
          const project = await tx.project.findUnique({
            where: { id: params.id },
            select: { pmId: true, name: true },
          });
          if (project) {
            await NotificationService.create({
              userId: project.pmId,
              title: "Project Blocked — Standby Status",
              body: `Engineer clocked in as Standby/Blocked on project "${project.name}". Standby charges are now accumulating.`,
              link: `/projects/${params.id}`,
            });
          }
        }
      }

      return logEntry;
    });

    // Check PO quota after each clock-in
    await checkAndNotifyQuota(params.id, session.user.id);

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects/:id/logsheet]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT — Clock out for today.
 * Updates the existing LogSheetEntry with clockOut time and calculates hours.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorised" }, { status: 401 });
    }

    const guard = guardRoute(
      session.user.roles,
      "logsheet:submit",
      getPermissionOverrides(session.user)
    );
    if (guard) return guard;

    const body = await req.json();
    const parsed = ClockOutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.progressRemarks) data.progressRemarks = sanitiseText(data.progressRemarks);

    const engineer = await prisma.engineer.findUnique({ where: { userId: session.user.id } });
    if (!engineer) {
      return NextResponse.json({ success: false, error: "Engineer record not found" }, { status: 404 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existing = await prisma.logSheetEntry.findUnique({
      where: {
        projectId_engineerId_date: {
          projectId: params.id,
          engineerId: engineer.id,
          date: today,
        },
      },
    });

    if (!existing || !existing.clockIn) {
      return NextResponse.json(
        { success: false, error: "No clock-in found for today. Please clock in first." },
        { status: 400 }
      );
    }

    if (existing.clockOut) {
      return NextResponse.json(
        { success: false, error: "Already clocked out for today" },
        { status: 409 }
      );
    }

    const clockOut = new Date();
    const hoursMs = clockOut.getTime() - existing.clockIn.getTime();
    const totalHours = Math.round((hoursMs / 3_600_000) * 100) / 100;
    const extraHours = Math.max(0, totalHours - STANDARD_SHIFT_HOURS);

    const entry = await prisma.$transaction(async (tx) => {
      const logEntry = await tx.logSheetEntry.update({
        where: { id: existing.id },
        data: {
          clockOut,
          totalHours,
          extraHours,
          progressRemarks: data.progressRemarks ?? existing.progressRemarks,
          reportStatus: data.reportStatus,
          clientCountersignatureUrl: data.clientCountersignatureUrl,
        },
      });

      // Update project daysConsumed: count distinct dates with WORKING_ON_JOB entries
      const workingDays = await tx.logSheetEntry.groupBy({
        by: ["date"],
        where: {
          projectId: params.id,
          dailyStatus: "WORKING_ON_JOB",
          clockOut: { not: null },
        },
      });

      await tx.project.update({
        where: { id: params.id },
        data: { daysConsumed: workingDays.length },
      });

      // Update standbyHoursTotal if STANDBY_BLOCKED
      if (existing.dailyStatus === "STANDBY_BLOCKED") {
        await tx.project.update({
          where: { id: params.id },
          data: {
            standbyHoursTotal: {
              increment: totalHours,
            },
          },
        });
      }

      // Reset engineer current status to null on clock-out
      await tx.engineer.update({
        where: { id: engineer.id },
        data: { currentStatus: null },
      });

      return logEntry;
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error("[PUT /api/projects/:id/logsheet]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Checks PO day quota and notifies PM at 80% consumption.
 */
async function checkAndNotifyQuota(projectId: string, _performedByUserId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { daysConsumed: true, daysAuthorised: true, pmId: true, name: true },
    });
    if (!project) return;

    const percent = Math.round((project.daysConsumed / project.daysAuthorised) * 100);
    if (percent >= 80 && percent < 81) {
      // Fire once at the 80% threshold
      await NotificationService.notifyQuotaAlert(project.pmId, project.name, projectId, percent);
    }
  } catch {
    // Non-critical — don't fail the main operation
  }
}
