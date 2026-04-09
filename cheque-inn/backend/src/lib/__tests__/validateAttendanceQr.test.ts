import { validateAttendanceQr } from "../validateAttendanceQr";
import * as branchesRepo from "../../modules/branches/branches.repository";

jest.mock("../../modules/branches/branches.repository");

const mockedBranchesRepo = branchesRepo as jest.Mocked<typeof branchesRepo>;

describe("validateAttendanceQr", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("rejects out-of-range latitude", async () => {
    const result = await validateAttendanceQr("c1", "branch:abc", 91, 10);
    expect(result).toEqual({ error: "Location verification failed" });
    expect(mockedBranchesRepo.findByQrCode).not.toHaveBeenCalled();
  });

  it("rejects out-of-range longitude", async () => {
    const result = await validateAttendanceQr("c1", "branch:abc", 20, -181);
    expect(result).toEqual({ error: "Location verification failed" });
    expect(mockedBranchesRepo.findByQrCode).not.toHaveBeenCalled();
  });

  it("accepts valid coordinates and resolves branch", async () => {
    mockedBranchesRepo.findByQrCode.mockResolvedValue({
      id: "b1",
      company_id: "c1",
      name: "Main",
      is_default: true,
      qr_code: "branch:abc",
      latitude: 10,
      longitude: 20,
      radius_meters: 100,
    });

    const result = await validateAttendanceQr("c1", "branch:abc", 10, 20);
    expect(result).toEqual({
      data: {
        branch_id: "b1",
        name: "Main",
      },
    });
  });
});
