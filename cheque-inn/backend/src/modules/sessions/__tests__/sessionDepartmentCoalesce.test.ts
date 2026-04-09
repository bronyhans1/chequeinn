import { coalesceSessionDepartmentFromProfile } from "../sessionDepartmentCoalesce";
import * as usersRepo from "../../users/users.repository";
import * as departmentsRepo from "../../departments/departments.repository";

jest.mock("../../users/users.repository");
jest.mock("../../departments/departments.repository");

const users = usersRepo as jest.Mocked<typeof usersRepo>;
const departments = departmentsRepo as jest.Mocked<typeof departmentsRepo>;

describe("coalesceSessionDepartmentFromProfile", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns explicit request department without loading profile", async () => {
    const id = await coalesceSessionDepartmentFromProfile("u1", "c1", "b1", "  d99  ");
    expect(id).toBe("d99");
    expect(users.getUserById).not.toHaveBeenCalled();
  });

  it("uses user profile department when it matches attendance branch", async () => {
    users.getUserById.mockResolvedValue({
      id: "u1",
      first_name: "A",
      last_name: "B",
      email: "a@b.c",
      company_id: "c1",
      branch_id: "b1",
      department_id: "d1",
      status: "active",
    });
    departments.findByIdAndCompanyId.mockResolvedValue({
      id: "d1",
      name: "Sales",
      company_id: "c1",
      branch_id: "b1",
    } as any);

    const id = await coalesceSessionDepartmentFromProfile("u1", "c1", "b1", undefined);
    expect(id).toBe("d1");
  });

  it("returns undefined when profile department is for another branch", async () => {
    users.getUserById.mockResolvedValue({
      id: "u1",
      first_name: "A",
      last_name: "B",
      email: "a@b.c",
      company_id: "c1",
      branch_id: "b1",
      department_id: "d1",
      status: "active",
    });
    departments.findByIdAndCompanyId.mockResolvedValue({
      id: "d1",
      name: "Remote",
      company_id: "c1",
      branch_id: "b-other",
    } as any);

    const id = await coalesceSessionDepartmentFromProfile("u1", "c1", "b1", undefined);
    expect(id).toBeUndefined();
  });
});
