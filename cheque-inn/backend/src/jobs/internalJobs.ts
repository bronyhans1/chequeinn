import { ENV } from "../config/env";
import { runForgotClockOutCheck } from "../modules/notifications/forgotClockOut.service";

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Optional in-process scheduler for local/staging only.
 * Production: use Render Cron → POST /api/internal/jobs/forgot-clock-out
 */
export function startInternalJobsIfEnabled(): void {
  if (ENV.isProduction || ENV.INTERNAL_JOB_INTERVAL_MS <= 0) return;
  if (intervalHandle) return;

  const ms = ENV.INTERNAL_JOB_INTERVAL_MS;
  console.log(`[jobs] Internal forgot-clock-out interval ${ms}ms (dev/staging)`);

  intervalHandle = setInterval(() => {
    runForgotClockOutCheck()
      .then((r) => {
        if (r.notified > 0) {
          console.log(`[jobs] forgot-clock-out notified=${r.notified} scanned=${r.scanned}`);
        }
      })
      .catch((err) => console.warn("[jobs] forgot-clock-out failed", err));
  }, ms);
}
