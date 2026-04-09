/**
 * Employee-facing copy for attendance (geofence, QR, clock-in/out).
 * Internal data model remains branch-based; these strings avoid "branch" where "office" is clearer.
 */

/** When the physical office site has no GPS/radius in DB yet. */
export const EMPLOYEE_MSG_OFFICE_NO_ATTENDANCE_LOCATION =
  "This office has no attendance location configured yet. Please contact an administrator.";

export const EMPLOYEE_MSG_NO_OFFICE_ASSIGNED =
  "Your account has no office assigned. Contact an administrator.";

export const EMPLOYEE_MSG_CHECKIN_ONLY_ASSIGNED_OFFICE =
  "You can only check in at your assigned office.";

export const EMPLOYEE_MSG_INVALID_DEPT_FOR_OFFICE =
  "Invalid department for your office.";

export const EMPLOYEE_MSG_DEPT_NOT_IN_OFFICE =
  "This department is not part of your office.";

/** Branch row missing or wrong company during clock-in geofence resolution. */
export const EMPLOYEE_MSG_OFFICE_LOCATION_VERIFY_FAILED =
  "Office location could not be verified.";

/** QR payload does not match any branch in this company. */
export const EMPLOYEE_MSG_INVALID_QR_ATTENDANCE =
  "Invalid QR code. Please scan your office QR code.";

export type OfficeGeofenceContext = "clock_in" | "clock_out" | "qr_scan";

/** Too far / must be on site — wording depends on flow. */
export function employeeMsgNearOfficeForContext(ctx: OfficeGeofenceContext): string {
  switch (ctx) {
    case "clock_in":
      return "You must be near your office to clock in";
    case "clock_out":
      return "You must be near your office to clock out";
    case "qr_scan":
      return "You are too far from your office to clock in";
    default:
      return "You must be near your office to complete attendance";
  }
}

/** Clock-out API: return 403 for geofence / missing office GPS (employee must be on site). */
export function isClockOutGeofenceError(err: string): boolean {
  return (
    err === "You must be near your office to clock out" ||
    err === EMPLOYEE_MSG_OFFICE_NO_ATTENDANCE_LOCATION
  );
}

/** QR validate endpoints: 403 when too far or office has no attendance coordinates. */
export function isQrAttendanceLocationForbiddenError(err: string): boolean {
  return (
    err.includes("too far") || err === EMPLOYEE_MSG_OFFICE_NO_ATTENDANCE_LOCATION
  );
}
