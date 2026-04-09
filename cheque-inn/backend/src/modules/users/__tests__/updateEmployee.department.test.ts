/**
 * updateEmployee — department assignment and branch-scoping rules.
 */
import type { UserRecord } from "../users.repository";
import * as repo from "../users.repository";
import * as branchesRepo from "../../branches/branches.repository";
import * as departmentsRepo from "../../departments/departments.repository";
import { updateEmployee } from "../users.service";

jest.mock("../users.repository");
jest.mock("../../branches/branches.repository");
jest.mock("../../departments/departments.repository");
jest.mock("../../../config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn().mockResolvedValue({
          data: [{ id: "company-1", name: "Acme Co" }],
          error: null,
        }),
      })),
    })),
  },
}));

const companyId = "company-1";
const branchA = "branch-a";
const branchB = "branch-b";
const userId = "user-1";
const deptA = "dept-a";
const deptB = "dept-b";

function baseUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: userId,
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    company_id: companyId,
    branch_id: branchA,
    department_id: null,
    status: "active",
    shift_id: null,
    ...overrides,
  };
}

const branchRow = (id: string, name: string) =>
  ({
    id,
    company_id: companyId,
    name,
    is_default: false,
  }) as import("../../branches/branches.repository").BranchRecord;

function wireStatefulUser(initial: UserRecord) {
  let state = { ...initial };
  jest.mocked(repo.findByIdAndCompanyId).mockImplementation(async (id, cid) => {
    if (id === state.id && cid === state.company_id) return { ...state };
    return null;
  });
  jest.mocked(repo.update).mockImplementation(async (id, cid, input) => {
    state = { ...state, ...input };
    return { ...state };
  });
  return () => state;
}

describe("updateEmployee — department assignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(repo.fetchRoleNamesForUserIds).mockResolvedValue(new Map([[userId, ["employee"]]]));
    jest.mocked(branchesRepo.findByIds).mockImplementation(async (ids) => {
      const m = new Map<string, import("../../branches/branches.repository").BranchRecord>();
      for (const id of ids) {
        if (id === branchA) m.set(id, branchRow(branchA, "Branch A"));
        if (id === branchB) m.set(id, branchRow(branchB, "Branch B"));
      }
      return m;
    });
  });

  it("assigns a department when it belongs to the user's branch", async () => {
    wireStatefulUser(baseUser());
    jest.mocked(departmentsRepo.findByIdAndCompanyId).mockImplementation(async (id, cid) => {
      if (id === deptA && cid === companyId) {
        return {
          id: deptA,
          company_id: companyId,
          branch_id: branchA,
          name: "Sales",
          created_at: "2024-01-01T00:00:00.000Z",
        };
      }
      return null;
    });
    const result = await updateEmployee(userId, companyId, { department_id: deptA }, undefined);
    expect(result.error).toBeUndefined();
    expect(result.user?.department_id).toBe(deptA);
    expect(result.user?.department?.name).toBe("Sales");
    expect(repo.update).toHaveBeenCalledWith(userId, companyId, { department_id: deptA });
  });

  it("rejects a department that belongs to another branch", async () => {
    wireStatefulUser(baseUser());
    jest.mocked(departmentsRepo.findByIdAndCompanyId).mockImplementation(async (id, cid) => {
      if (id === deptB && cid === companyId) {
        return {
          id: deptB,
          company_id: companyId,
          branch_id: branchB,
          name: "Other",
          created_at: "2024-01-01T00:00:00.000Z",
        };
      }
      return null;
    });
    const result = await updateEmployee(userId, companyId, { department_id: deptB }, undefined);
    expect(result.user).toBeNull();
    expect(result.error).toBe("department_id must belong to the user's current branch");
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("auto-clears department when branch changes and the department is no longer valid", async () => {
    wireStatefulUser(
      baseUser({
        branch_id: branchA,
        department_id: deptA,
      })
    );
    jest.mocked(branchesRepo.findById).mockImplementation(async (id) => {
      if (id === branchB) return branchRow(branchB, "Branch B");
      return null;
    });
    jest.mocked(departmentsRepo.findByIdAndCompanyId).mockImplementation(async (id, cid) => {
      if (id === deptA && cid === companyId) {
        return {
          id: deptA,
          company_id: companyId,
          branch_id: branchA,
          name: "Sales",
          created_at: "2024-01-01T00:00:00.000Z",
        };
      }
      return null;
    });
    const result = await updateEmployee(userId, companyId, { branch_id: branchB }, undefined);
    expect(result.error).toBeUndefined();
    expect(result.audit).toEqual({ department_auto_cleared: true });
    expect(repo.update).toHaveBeenCalledWith(userId, companyId, {
      branch_id: branchB,
      department_id: null,
    });
    expect(result.user?.branch_id).toBe(branchB);
    expect(result.user?.department_id).toBeNull();
  });

  it("returns User not found when manager restrict branch does not match target user branch", async () => {
    wireStatefulUser(baseUser({ branch_id: branchB }));
    const result = await updateEmployee(userId, companyId, { department_id: deptA }, branchA);
    expect(result.user).toBeNull();
    expect(result.error).toBe("User not found");
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("allows department assignment when manager restrict branch matches user branch", async () => {
    wireStatefulUser(baseUser({ branch_id: branchA }));
    jest.mocked(departmentsRepo.findByIdAndCompanyId).mockImplementation(async (id, cid) => {
      if (id === deptA && cid === companyId) {
        return {
          id: deptA,
          company_id: companyId,
          branch_id: branchA,
          name: "Sales",
          created_at: "2024-01-01T00:00:00.000Z",
        };
      }
      return null;
    });
    const result = await updateEmployee(userId, companyId, { department_id: deptA }, branchA);
    expect(result.error).toBeUndefined();
    expect(result.user?.department_id).toBe(deptA);
  });
});
