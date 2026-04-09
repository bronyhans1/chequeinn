import * as branchesService from "../branches.service";
import * as branchesRepo from "../branches.repository";

jest.mock("../branches.repository");

const mockedRepo = branchesRepo as jest.Mocked<typeof branchesRepo>;

describe("branches.service.createBranch (branch_limit)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("blocks branch creation when company is at branch_limit", async () => {
    mockedRepo.getCompanyBranchLimit.mockResolvedValue(1);
    mockedRepo.listByCompanyId.mockResolvedValue([
      { id: "b1", company_id: "c1", name: "Main", is_default: true },
    ] as any);

    const res = await branchesService.createBranch("c1", "New Branch");

    expect(res).toEqual({
      error: "Branch limit reached for this company. Contact platform admin to increase the limit.",
    });
    expect(mockedRepo.insertBranch).not.toHaveBeenCalled();
  });

  it("allows branch creation when branch_limit is NULL (unlimited)", async () => {
    mockedRepo.getCompanyBranchLimit.mockResolvedValue(null);
    mockedRepo.listByCompanyId.mockResolvedValue([
      { id: "b1", company_id: "c1", name: "Main", is_default: true },
    ] as any);
    mockedRepo.insertBranch.mockResolvedValue({
      id: "b2",
      company_id: "c1",
      name: "New Branch",
      is_default: false,
      qr_code: "branch:b2",
    } as any);

    const res = await branchesService.createBranch("c1", "New Branch");

    expect(res.data?.id).toBe("b2");
    expect(res.data?.name).toBe("New Branch");
    expect(mockedRepo.insertBranch).toHaveBeenCalled();
  });
});

