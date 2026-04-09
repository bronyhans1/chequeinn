import * as repo from "./departments.repository";
import * as branchesRepo from "../branches/branches.repository";

export interface CreateDepartmentInput {
  name: string;
  branch_id?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  branch_id?: string;
}

export type DepartmentWithBranch = repo.DepartmentRecord & {
  branch: { id: string; name: string } | null;
};

export interface ServiceResult<T> {
  data: T | null;
  error?: string;
}

function trimString(value: string | undefined): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

async function withBranches(
  rows: repo.DepartmentRecord[]
): Promise<DepartmentWithBranch[]> {
  const ids = [...new Set(rows.map((o) => o.branch_id).filter(Boolean))];
  const map = await branchesRepo.findByIds(ids);
  return rows.map((o) => {
    const b = o.branch_id ? map.get(o.branch_id) ?? null : null;
    return {
      ...o,
      branch: b ? { id: b.id, name: b.name } : null,
    };
  });
}

export async function createDepartment(
  companyId: string,
  input: CreateDepartmentInput,
  options?: { forceBranchId?: string }
): Promise<ServiceResult<DepartmentWithBranch>> {
  const name = trimString(input.name);

  if (!name) {
    return { data: null, error: "name is required" };
  }

  let branchId: string;
  const forced = trimString(options?.forceBranchId);
  if (forced) {
    const b = await branchesRepo.findById(forced);
    if (!b || b.company_id !== companyId) {
      return { data: null, error: "branch_id is invalid for this company" };
    }
    branchId = b.id;
  } else {
    const reqBranch = trimString(input.branch_id);
    if (reqBranch) {
      const b = await branchesRepo.findById(reqBranch);
      if (!b || b.company_id !== companyId) {
        return { data: null, error: "branch_id is invalid for this company" };
      }
      branchId = b.id;
    } else {
      branchId = (await branchesRepo.ensureDefaultBranch(companyId)).id;
    }
  }

  const row = await repo.createDepartment({
    company_id: companyId,
    branch_id: branchId,
    name,
  });

  const [enriched] = await withBranches([row]);
  return { data: enriched };
}

export async function listDepartments(
  companyId: string,
  listBranchId?: string
): Promise<DepartmentWithBranch[]> {
  const rows = await repo.findAllByCompanyId(companyId, listBranchId);
  return withBranches(rows);
}

export async function getDepartmentById(
  id: string,
  companyId: string,
  restrictToBranchId?: string
): Promise<DepartmentWithBranch | null> {
  const o = await repo.findByIdAndCompanyId(id, companyId);
  if (!o) return null;
  if (restrictToBranchId && o.branch_id !== restrictToBranchId) {
    return null;
  }
  const [enriched] = await withBranches([o]);
  return enriched;
}

export async function updateDepartment(
  id: string,
  companyId: string,
  input: UpdateDepartmentInput,
  restrictToBranchId?: string
): Promise<ServiceResult<DepartmentWithBranch>> {
  const existing = await repo.findByIdAndCompanyId(id, companyId);
  if (!existing) {
    return { data: null, error: "Department not found" };
  }
  if (restrictToBranchId && existing.branch_id !== restrictToBranchId) {
    return { data: null, error: "Department not found" };
  }

  const updates: repo.UpdateDepartmentInput = {};

  if (input.name !== undefined) {
    const name = trimString(input.name);
    if (!name) {
      return { data: null, error: "name is required" };
    }
    updates.name = name;
  }

  if (input.branch_id !== undefined) {
    const bid = trimString(input.branch_id);
    if (!bid) {
      return { data: null, error: "branch_id cannot be empty" };
    }
    const b = await branchesRepo.findById(bid);
    if (!b || b.company_id !== companyId) {
      return { data: null, error: "branch_id is invalid for this company" };
    }
    updates.branch_id = bid;
  }

  if (Object.keys(updates).length === 0) {
    const [enriched] = await withBranches([existing]);
    return { data: enriched };
  }

  const updated = await repo.updateDepartment(id, companyId, updates);
  const row = updated ?? existing;
  const [enriched] = await withBranches([row]);
  return { data: enriched };
}

export async function deleteDepartment(
  id: string,
  companyId: string,
  restrictToBranchId?: string
): Promise<{ success: boolean; error?: string }> {
  const existing = await repo.findByIdAndCompanyId(id, companyId);
  if (!existing) {
    return { success: false, error: "Department not found" };
  }
  if (restrictToBranchId && existing.branch_id !== restrictToBranchId) {
    return { success: false, error: "Department not found" };
  }

  const success = await repo.deleteDepartment(id, companyId);
  return { success };
}
