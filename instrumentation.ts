/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts. Used to initialise cron jobs.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initCronJobs } = await import("./src/lib/cron");
    initCronJobs();
  }
}
