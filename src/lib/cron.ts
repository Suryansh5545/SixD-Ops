/**
 * Cron job scheduler — runs inside the Next.js server process.
 * Initialised once at server startup via instrumentation.ts.
 *
 * On VPS deployment, this works because Next.js runs as a persistent Node.js process.
 * node-cron schedules are in IST (UTC+5:30).
 *
 * Jobs:
 *   - 08:00 IST daily: Compliance expiry alerts + PO expiry alerts
 *   - 09:00 IST daily: Payment reminder processing
 */

import cron from "node-cron";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

async function callCronEndpoint(path: string) {
  try {
    const res = await fetch(`${APP_URL}${path}`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json();
    console.log(`[Cron] ${path}:`, data);
  } catch (error) {
    console.error(`[Cron] Failed to call ${path}:`, error);
  }
}

let initialized = false;

export function initCronJobs() {
  if (initialized) return;
  initialized = true;

  // 08:00 IST = 02:30 UTC
  // node-cron uses local server time, so if server is in UTC: "30 2 * * *"
  // If server is in IST: "0 8 * * *"
  // We use UTC values here — adjust if VPS is configured in IST
  cron.schedule("30 2 * * *", async () => {
    console.log("[Cron] Running compliance-expiry job");
    await callCronEndpoint("/api/cron/compliance-expiry");
  });

  // 09:00 IST = 03:30 UTC
  cron.schedule("30 3 * * *", async () => {
    console.log("[Cron] Running payment-reminders job");
    await callCronEndpoint("/api/cron/payment-reminders");
  });

  console.log("[Cron] Jobs scheduled — compliance at 08:00 IST, reminders at 09:00 IST");
}
