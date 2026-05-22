import * as companyPolicy from "../companyPolicy/companyPolicy.service";
import * as shiftsRepo from "../shifts/shifts.repository";
import * as usersRepo from "../users/users.repository";
import { resolveShiftWindow, toShiftWindowSource } from "../../lib/shiftWindow";
import { normalizeBusinessTimeZone } from "../../lib/businessCalendar";
import { ENV } from "../../config/env";
import { NotificationType } from "./notificationTypes";
import { dispatchNotification } from "./notificationDispatch.service";
import * as repo from "./notifications.repository";

function parseExpectedEndMs(
  expectedEndUtcIso: string | null,
  checkInIso: string,
  fallbackHours: number
): number {
  if (expectedEndUtcIso) {
    return new Date(expectedEndUtcIso).getTime();
  }
  return new Date(checkInIso).getTime() + fallbackHours * 60 * 60 * 1000;
}

/**
 * Evaluate open sessions; notify employees when shift end + grace has passed (overnight-aware).
 */
export async function runForgotClockOutCheck(): Promise<{
  scanned: number;
  notified: number;
}> {
  const sessions = await repo.listOpenWorkSessions(500);
  const graceMs = ENV.NOTIFICATION_FORGOT_CLOCKOUT_GRACE_MINUTES * 60 * 1000;
  const nowMs = Date.now();
  let notified = 0;

  const policyCache = new Map<string, Awaited<ReturnType<typeof companyPolicy.getPolicy>>>();

  for (const s of sessions) {
    if (!s.check_in) continue;

    let policy = policyCache.get(s.company_id);
    if (!policy) {
      policy = await companyPolicy.getPolicy(s.company_id);
      policyCache.set(s.company_id, policy);
    }
    const bizTz = normalizeBusinessTimeZone(
      (policy as { business_timezone?: string }).business_timezone
    );
    const overnightOn =
      (policy as { overnight_shifts_enabled?: boolean }).overnight_shifts_enabled === true;

    let shift = null;
    if (s.shift_id) {
      shift = await shiftsRepo.getShiftById(s.shift_id, s.company_id);
    }
    if (!shift) {
      const user = await usersRepo.getUserById(s.user_id);
      if (user?.shift_id) {
        shift = await shiftsRepo.getShiftById(user.shift_id, s.company_id);
      }
    }

    const window = resolveShiftWindow({
      anchorIso: s.check_in,
      businessTimeZone: bizTz,
      overnightShiftsEnabled: overnightOn,
      shift: shift ? toShiftWindowSource(shift) : null,
    });

    const expectedEndMs = parseExpectedEndMs(
      window.expectedEndUtcIso,
      s.check_in,
      8
    );
    if (nowMs < expectedEndMs + graceMs) continue;

    const attendanceDay = s.attendance_date ?? window.attendanceDateYmd;
    const row = await dispatchNotification({
      companyId: s.company_id,
      userId: s.user_id,
      type: NotificationType.FORGOT_CLOCK_OUT,
      title: "Still clocked in?",
      body: `Your session for ${attendanceDay} may need a clock-out. Open the app to check out when you finish.`,
      dedupeKey: `forgot_clock_out:${s.id}`,
      metadata: {
        session_id: s.id,
        attendance_date: attendanceDay,
        expected_end_utc: window.expectedEndUtcIso,
      },
      sendEmail: true,
    });
    if (row) notified += 1;
  }

  return { scanned: sessions.length, notified };
}
