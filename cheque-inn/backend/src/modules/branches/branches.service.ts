import * as repo from "./branches.repository";
import { validateAttendanceQr } from "../../lib/validateAttendanceQr";

export type BranchDto = {
  id: string;
  company_id: string;
  name: string;
  is_default: boolean;
  created_at?: string;
  /** Attendance QR payload (branch:{uuid}). */
  qr_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
};

function toDto(r: repo.BranchRecord): BranchDto {
  return {
    id: r.id,
    company_id: r.company_id,
    name: r.name,
    is_default: r.is_default,
    created_at: r.created_at,
    qr_code: r.qr_code ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    radius_meters: r.radius_meters ?? null,
  };
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
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

function duplicateName(
  companyId: string,
  nameNorm: string,
  branches: repo.BranchRecord[],
  excludeId?: string
): boolean {
  const lower = nameNorm.toLowerCase();
  return branches.some(
    (b) =>
      b.id !== excludeId &&
      b.company_id === companyId &&
      normalizeName(b.name).toLowerCase() === lower
  );
}

export async function listBranches(
  companyId: string,
  onlyBranchId?: string
): Promise<BranchDto[]> {
  const rows = await repo.listByCompanyId(companyId);
  const filtered =
    onlyBranchId !== undefined && onlyBranchId !== null && onlyBranchId !== ""
      ? rows.filter((r) => r.id === onlyBranchId)
      : rows;
  return filtered.map(toDto);
}

export async function createBranch(
  companyId: string,
  rawName: string
): Promise<{ data?: BranchDto; error?: string }> {
  const name = normalizeName(rawName);
  if (!name) {
    return { error: "name is required" };
  }
  if (name.length > 200) {
    return { error: "name is too long (max 200 characters)" };
  }

  const [branches, branchLimit] = await Promise.all([
    repo.listByCompanyId(companyId),
    repo.getCompanyBranchLimit(companyId),
  ]);

  if (branchLimit !== null && branches.length >= branchLimit) {
    return {
      error:
        "Branch limit reached for this company. Contact platform admin to increase the limit.",
    };
  }

  if (duplicateName(companyId, name, branches)) {
    return { error: "A branch with this name already exists in your company" };
  }

  const row = await repo.insertBranch(companyId, name, false);
  return { data: toDto(row) };
}

export async function updateBranch(
  companyId: string,
  branchId: string,
  input: {
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
    radius_meters?: number | null;
  }
): Promise<{ data?: BranchDto; error?: string }> {
  const existing = await repo.findById(branchId);
  if (!existing || existing.company_id !== companyId) {
    return { error: "Branch not found" };
  }

  const hasName = input.name !== undefined && String(input.name).trim() !== "";
  const hasAttendance =
    input.latitude !== undefined ||
    input.longitude !== undefined ||
    input.radius_meters !== undefined;

  if (!hasName && !hasAttendance) {
    return { error: "Provide name and/or attendance fields (latitude, longitude, radius_meters)" };
  }

  let row: repo.BranchRecord | null = existing;

  if (hasName) {
    const name = normalizeName(String(input.name));
    if (!name) {
      return { error: "name is required" };
    }
    if (name.length > 200) {
      return { error: "name is too long (max 200 characters)" };
    }
    const branches = await repo.listByCompanyId(companyId);
    if (duplicateName(companyId, name, branches, branchId)) {
      return { error: "A branch with this name already exists in your company" };
    }
    const updated = await repo.updateBranchName(branchId, companyId, name);
    if (!updated) {
      return { error: "Branch not found" };
    }
    row = updated;
  }

  if (hasAttendance) {
    if (input.latitude !== undefined && input.latitude !== null) {
      if (!isFiniteNumber(input.latitude) || !isValidLatitude(input.latitude)) {
        return { error: "latitude must be between -90 and 90" };
      }
    }
    if (input.longitude !== undefined && input.longitude !== null) {
      if (!isFiniteNumber(input.longitude) || !isValidLongitude(input.longitude)) {
        return { error: "longitude must be between -180 and 180" };
      }
    }
    if (input.radius_meters !== undefined && input.radius_meters !== null) {
      if (!isFiniteNumber(input.radius_meters) || input.radius_meters < 10 || input.radius_meters > 2000) {
        return { error: "radius_meters must be between 10 and 2000" };
      }
    }
    const att: repo.UpdateBranchAttendanceInput = {};
    if (input.latitude !== undefined) att.latitude = input.latitude;
    if (input.longitude !== undefined) att.longitude = input.longitude;
    if (input.radius_meters !== undefined) att.radius_meters = input.radius_meters;
    const updated = await repo.updateBranchAttendance(branchId, companyId, att);
    if (!updated) {
      return { error: "Branch not found" };
    }
    row = updated;
  }

  return { data: toDto(row!) };
}

export async function validateBranchQr(
  companyId: string,
  qrCode: string,
  latitude: number,
  longitude: number
): Promise<{ data?: { branch_id: string; name: string }; error?: string }> {
  const result = await validateAttendanceQr(companyId, qrCode, latitude, longitude);
  if (result.error) {
    return { error: result.error };
  }
  return { data: result.data };
}

export async function deleteBranch(
  companyId: string,
  branchId: string
): Promise<{ success?: boolean; error?: string }> {
  const existing = await repo.findById(branchId);
  if (!existing || existing.company_id !== companyId) {
    return { error: "Branch not found" };
  }
  if (existing.is_default) {
    return { error: "The default branch cannot be deleted" };
  }

  const [userCount, departmentCount] = await Promise.all([
    repo.countUsersForBranch(branchId),
    repo.countDepartmentsForBranch(branchId),
  ]);

  if (userCount > 0 || departmentCount > 0) {
    return {
      error:
        "Cannot delete a branch that still has users or departments assigned. Reassign them first.",
    };
  }

  const ok = await repo.deleteBranchRow(branchId, companyId);
  if (!ok) {
    return { error: "Branch not found" };
  }
  return { success: true };
}
