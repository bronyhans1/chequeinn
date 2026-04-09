/**
 * updateUser controller — HR must not be able to assign departments (403 before service).
 */
import type { Response } from "express";
import type { ContextRequest } from "../../../middleware/context.middleware";
import * as usersService from "../users.service";
import * as usersController from "../users.controller";

jest.mock("../users.service");
jest.mock("../../audit/audit.service", () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}));

function mockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function ctxReq(partial: Partial<ContextRequest["context"]> & { body?: Record<string, unknown>; params?: { id: string } }): ContextRequest {
  const { body, params, ...ctx } = partial as Record<string, unknown>;
  return {
    body: body ?? {},
    params: params ?? { id: "user-1" },
    context: {
      userId: "actor-1",
      companyId: "company-1",
      branchId: "branch-a",
      roles: ["HR"],
      ...ctx,
    },
  } as ContextRequest;
}

describe("updateUser — HR cannot assign department", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when HR sends department_id", async () => {
    const req = ctxReq({
      roles: ["HR"],
      branchId: "branch-a",
      body: { department_id: "dept-1" },
      params: { id: "user-1" },
    });
    const res = mockRes();
    await usersController.updateUser(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(usersService.updateEmployee).not.toHaveBeenCalled();
  });

  it("allows HR to PATCH without department_id key (service still invoked)", async () => {
    jest.mocked(usersService.updateEmployee).mockResolvedValue({
      user: {
        id: "user-1",
        first_name: "A",
        last_name: "B",
        email: "a@b.com",
        company_id: "company-1",
        company_name: "Co",
        branch_id: "branch-a",
        department_id: null,
        status: "active",
        branch: null,
        department: null,
      },
    });
    const req = ctxReq({
      roles: ["HR"],
      branchId: "branch-a",
      body: { first_name: "Updated" },
      params: { id: "user-1" },
    });
    const res = mockRes();
    await usersController.updateUser(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(usersService.updateEmployee).toHaveBeenCalled();
  });
});
