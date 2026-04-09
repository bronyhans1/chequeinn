import * as branchesRepo from "../modules/branches/branches.repository";
import {
  EMPLOYEE_MSG_INVALID_QR_ATTENDANCE,
  EMPLOYEE_MSG_OFFICE_NO_ATTENDANCE_LOCATION,
  employeeMsgNearOfficeForContext,
  type OfficeGeofenceContext,
} from "../constants/employeeAttendanceMessages";

function trimString(value: string | undefined): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatitude(value: number): boolean {
  return value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return value >= -180 && value <= 180;
}

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Server-side geofence check using branch row (internal). Returns employee-facing messages.
 */
export function checkBranchGeofence(
  branch: {
    latitude?: number | null;
    longitude?: number | null;
    radius_meters?: number | null;
  },
  latitude: number,
  longitude: number,
  context: OfficeGeofenceContext
): { ok: true } | { ok: false; error: string } {
  if (
    branch.latitude === null ||
    branch.latitude === undefined ||
    branch.longitude === null ||
    branch.longitude === undefined
  ) {
    return {
      ok: false,
      error: EMPLOYEE_MSG_OFFICE_NO_ATTENDANCE_LOCATION,
    };
  }
  const distance = calculateDistanceMeters(
    latitude,
    longitude,
    branch.latitude,
    branch.longitude
  );
  const allowedRadius = branch.radius_meters ?? 50;
  if (distance > allowedRadius) {
    return { ok: false, error: employeeMsgNearOfficeForContext(context) };
  }
  return { ok: true };
}

export type ValidateAttendanceQrResult =
  | { data: { branch_id: string; name: string }; error?: undefined }
  | { data?: undefined; error: string };

/**
 * Validates scanned QR + GPS against the branch attendance geofence (internal).
 * Only `branch:{uuid}` payloads are supported; attendance QR/GPS live on branches.
 */
export async function validateAttendanceQr(
  companyId: string,
  rawQr: string,
  latitude: number,
  longitude: number
): Promise<ValidateAttendanceQrResult> {
  const trimmed = trimString(rawQr);
  if (!trimmed) {
    return { error: EMPLOYEE_MSG_INVALID_QR_ATTENDANCE };
  }
  if (
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    !isValidLatitude(latitude) ||
    !isValidLongitude(longitude)
  ) {
    return { error: "Location verification failed" };
  }

  let branch: Awaited<ReturnType<typeof branchesRepo.findById>> = null;

  if (trimmed.startsWith("branch:")) {
    const b = await branchesRepo.findByQrCode(trimmed, companyId);
    branch = b;
  } else {
    return { error: EMPLOYEE_MSG_INVALID_QR_ATTENDANCE };
  }

  if (!branch) {
    return { error: EMPLOYEE_MSG_INVALID_QR_ATTENDANCE };
  }

  const geo = checkBranchGeofence(branch, latitude, longitude, "qr_scan");
  if (!geo.ok) {
    return { error: geo.error };
  }

  return {
    data: {
      branch_id: branch.id,
      name: branch.name,
    },
  };
}
