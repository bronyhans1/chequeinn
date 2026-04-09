import { evaluateAccessForRequester } from "../accountStatus";

describe("evaluateAccessForRequester", () => {
  test("blocks inactive user regardless of PLATFORM_ADMIN role", () => {
    const r = evaluateAccessForRequester({
      roles: ["PLATFORM_ADMIN", "admin"],
      userRow: { status: "inactive", company_id: "c1" },
      companyStatus: "active",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.block.code).toBe("USER_INACTIVE");
  });

  test("blocks suspended company when user has company_id", () => {
    const r = evaluateAccessForRequester({
      roles: ["employee"],
      userRow: { status: "active", company_id: "c1" },
      companyStatus: "suspended",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.block.code).toBe("COMPANY_SUSPENDED");
  });

  test("allows active user and active company", () => {
    const r = evaluateAccessForRequester({
      roles: ["employee"],
      userRow: { status: "active", company_id: "c1" },
      companyStatus: "active",
    });
    expect(r.allowed).toBe(true);
  });
});
