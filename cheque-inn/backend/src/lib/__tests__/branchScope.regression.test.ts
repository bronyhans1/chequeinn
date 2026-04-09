/**
 * Regression tests for branch / company authorization scoping.
 * Covers logic shared by attendance aggregates, leave lists, session history, exports, reports, and manual clock.
 */
import type { ContextRequest, RequestContext } from "../../middleware/context.middleware";
import {
  isCompanyAdminRole,
  isBranchScopedManagerRole,
  assertBranchContextForScopedRole,
} from "../branchAccess";
import {
  resolveAggregationUserIds,
  resolveManagerListUserIds,
  listBranchIdFromContext,
} from "../resolveScopedUserIds";
import { assertManualClockTargetAllowed } from "../manualClockScope";
import * as usersRepo from "../../modules/users/users.repository";

jest.mock("../../modules/users/users.repository", () => ({
  findActiveUserIdsByBranch: jest.fn(),
  findByIdAndCompanyId: jest.fn(),
}));

const companyId = "company-1";
const branchA = "branch-a";
const branchB = "branch-b";
const adminUser = "user-admin";
const mgrUser = "user-mgr";
const empUser = "user-emp";

function ctx(partial: Partial<RequestContext>): RequestContext {
  return {
    userId: adminUser,
    companyId,
    branchId: null,
    roles: [],
    ...partial,
  };
}

function asReq(c: RequestContext): ContextRequest {
  return { context: c } as ContextRequest;
}

describe("branchAccess", () => {
  it("treats admin as company-wide (not branch-scoped manager)", () => {
    expect(isCompanyAdminRole(["admin"])).toBe(true);
    expect(isBranchScopedManagerRole(["admin"])).toBe(false);
    expect(isBranchScopedManagerRole(["admin", "manager"])).toBe(false);
  });

  it("treats manager and HR as branch-scoped when not admin", () => {
    expect(isBranchScopedManagerRole(["manager"])).toBe(true);
    expect(isBranchScopedManagerRole(["HR"])).toBe(true);
    expect(isBranchScopedManagerRole(["employee"])).toBe(false);
  });

  it("assertBranchContextForScopedRole: manager without branchId returns 403", () => {
    const r = assertBranchContextForScopedRole(
      ctx({ roles: ["manager"], branchId: null })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("assertBranchContextForScopedRole: manager with branchId succeeds", () => {
    const r = assertBranchContextForScopedRole(
      ctx({ roles: ["manager"], branchId: branchA })
    );
    expect(r.ok).toBe(true);
  });
});

describe("resolveAggregationUserIds (attendance /dashboard-style aggregates)", () => {
  beforeEach(() => {
    jest.mocked(usersRepo.findActiveUserIdsByBranch).mockReset();
  });

  it("admin: no user filter (company-wide)", async () => {
    const out = await resolveAggregationUserIds(
      ctx({ roles: ["admin"], userId: adminUser }),
      companyId
    );
    expect(out).toEqual({ scopedUserIds: undefined });
    expect(usersRepo.findActiveUserIdsByBranch).not.toHaveBeenCalled();
  });

  it("manager/HR: restricted to active users in their branch", async () => {
    jest.mocked(usersRepo.findActiveUserIdsByBranch).mockResolvedValue(["u1", "u2"]);
    const out = await resolveAggregationUserIds(
      ctx({ roles: ["manager"], branchId: branchA, userId: mgrUser }),
      companyId
    );
    expect(out).toEqual({ scopedUserIds: ["u1", "u2"] });
    expect(usersRepo.findActiveUserIdsByBranch).toHaveBeenCalledWith(companyId, branchA);
  });

  it("manager/HR: missing branch context returns 403", async () => {
    const out = await resolveAggregationUserIds(
      ctx({ roles: ["HR"], branchId: null, userId: mgrUser }),
      companyId
    );
    expect(out).toEqual({
      error: { status: 403, message: "Branch context required for this role" },
    });
  });

  it("employee: only own user id", async () => {
    const out = await resolveAggregationUserIds(
      ctx({ roles: ["employee"], userId: empUser }),
      companyId
    );
    expect(out).toEqual({ scopedUserIds: [empUser] });
  });
});

describe("resolveManagerListUserIds (leave, session history, exports, reports scope)", () => {
  beforeEach(() => {
    jest.mocked(usersRepo.findActiveUserIdsByBranch).mockReset();
  });

  it("admin: company-wide (no user filter)", async () => {
    const out = await resolveManagerListUserIds(
      ctx({ roles: ["admin"] }),
      companyId
    );
    expect(out).toEqual({ scopedUserIds: undefined });
  });

  it("manager: branch user ids only", async () => {
    jest.mocked(usersRepo.findActiveUserIdsByBranch).mockResolvedValue(["x"]);
    const out = await resolveManagerListUserIds(
      ctx({ roles: ["manager"], branchId: branchA }),
      companyId
    );
    expect(out).toEqual({ scopedUserIds: ["x"] });
    expect(usersRepo.findActiveUserIdsByBranch).toHaveBeenCalledWith(companyId, branchA);
  });

  it("employee: cannot access company-wide manager lists", async () => {
    const out = await resolveManagerListUserIds(
      ctx({ roles: ["employee"], userId: empUser }),
      companyId
    );
    expect(out).toEqual({
      error: { status: 403, message: "Insufficient permissions for company-wide data" },
    });
  });
});

describe("listBranchIdFromContext (user directory / departments list filtering)", () => {
  it("admin: no branch filter (full company)", () => {
    expect(listBranchIdFromContext(ctx({ roles: ["admin"] }))).toBeUndefined();
  });

  it("manager: filters to their branch", () => {
    expect(listBranchIdFromContext(ctx({ roles: ["manager"], branchId: branchA }))).toBe(
      branchA
    );
  });
});

describe("assertManualClockTargetAllowed (manual clock-in/out branch boundaries)", () => {
  beforeEach(() => {
    jest.mocked(usersRepo.findByIdAndCompanyId).mockReset();
  });

  it("admin may target any user in company (no branch check)", async () => {
    const out = await assertManualClockTargetAllowed(
      asReq(ctx({ roles: ["admin"] })),
      companyId,
      "target-1"
    );
    expect(out).toEqual({ ok: true });
    expect(usersRepo.findByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it("manager may manual-clock only users in the same branch", async () => {
    jest.mocked(usersRepo.findByIdAndCompanyId).mockResolvedValue({
      id: "target-1",
      branch_id: branchA,
    } as Awaited<ReturnType<typeof usersRepo.findByIdAndCompanyId>>);
    const out = await assertManualClockTargetAllowed(
      asReq(ctx({ roles: ["manager"], branchId: branchA })),
      companyId,
      "target-1"
    );
    expect(out).toEqual({ ok: true });
  });

  it("manager cannot manual-clock a user in another branch (404 User not found)", async () => {
    jest.mocked(usersRepo.findByIdAndCompanyId).mockResolvedValue({
      id: "target-1",
      branch_id: branchB,
    } as Awaited<ReturnType<typeof usersRepo.findByIdAndCompanyId>>);
    const out = await assertManualClockTargetAllowed(
      asReq(ctx({ roles: ["manager"], branchId: branchA })),
      companyId,
      "target-1"
    );
    expect(out).toEqual({ ok: false, status: 404, message: "User not found" });
  });

  it("manager without branch context returns 403", async () => {
    const out = await assertManualClockTargetAllowed(
      asReq(ctx({ roles: ["manager"], branchId: null })),
      companyId,
      "target-1"
    );
    expect(out).toEqual({
      ok: false,
      status: 403,
      message: "Branch context required for this role",
    });
  });

  it("HR may manual-clock users in the same branch", async () => {
    jest.mocked(usersRepo.findByIdAndCompanyId).mockResolvedValue({
      id: "target-1",
      branch_id: branchA,
    } as Awaited<ReturnType<typeof usersRepo.findByIdAndCompanyId>>);
    const out = await assertManualClockTargetAllowed(
      asReq(ctx({ roles: ["HR"], branchId: branchA })),
      companyId,
      "target-1"
    );
    expect(out).toEqual({ ok: true });
  });

  it("HR cannot manual-clock a user in another branch", async () => {
    jest.mocked(usersRepo.findByIdAndCompanyId).mockResolvedValue({
      id: "target-1",
      branch_id: branchB,
    } as Awaited<ReturnType<typeof usersRepo.findByIdAndCompanyId>>);
    const out = await assertManualClockTargetAllowed(
      asReq(ctx({ roles: ["HR"], branchId: branchA })),
      companyId,
      "target-1"
    );
    expect(out).toEqual({ ok: false, status: 404, message: "User not found" });
  });

  it("employee cannot manual-clock (403)", async () => {
    const out = await assertManualClockTargetAllowed(
      asReq(ctx({ roles: ["employee"], branchId: branchA })),
      companyId,
      "target-1"
    );
    expect(out).toEqual({
      ok: false,
      status: 403,
      message: "You do not have permission to record manual attendance",
    });
    expect(usersRepo.findByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
