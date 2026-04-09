import {
  messageIfCannotDisablePayroll,
  payrollDisableBlockedByArtifacts,
} from "../payrollDisableGuard";

describe("payrollDisableGuard", () => {
  describe("messageIfCannotDisablePayroll", () => {
    it("allows undefined requested (no change intent)", () => {
      expect(
        messageIfCannotDisablePayroll({
          requestedPayrollEnabled: undefined,
          currentPayrollEnabled: true,
          hasPayrollRecords: true,
          hasWageRateRows: true,
        })
      ).toBeNull();
    });

    it("allows turning off when no artifacts", () => {
      expect(
        messageIfCannotDisablePayroll({
          requestedPayrollEnabled: false,
          currentPayrollEnabled: true,
          hasPayrollRecords: false,
          hasWageRateRows: false,
        })
      ).toBeNull();
    });

    it("blocks turning off when payroll records exist", () => {
      const msg = messageIfCannotDisablePayroll({
        requestedPayrollEnabled: false,
        currentPayrollEnabled: true,
        hasPayrollRecords: true,
        hasWageRateRows: false,
      });
      expect(msg).toContain("cannot be turned off");
    });

    it("blocks turning off when wage rows exist", () => {
      const msg = messageIfCannotDisablePayroll({
        requestedPayrollEnabled: false,
        currentPayrollEnabled: true,
        hasPayrollRecords: false,
        hasWageRateRows: true,
      });
      expect(msg).toContain("cannot be turned off");
    });

    it("allows request when payroll already off (idempotent)", () => {
      expect(
        messageIfCannotDisablePayroll({
          requestedPayrollEnabled: false,
          currentPayrollEnabled: false,
          hasPayrollRecords: true,
          hasWageRateRows: true,
        })
      ).toBeNull();
    });

    it("allows turning payroll on", () => {
      expect(
        messageIfCannotDisablePayroll({
          requestedPayrollEnabled: true,
          currentPayrollEnabled: false,
          hasPayrollRecords: true,
          hasWageRateRows: true,
        })
      ).toBeNull();
    });
  });

  describe("payrollDisableBlockedByArtifacts", () => {
    it("is false when neither exists", () => {
      expect(payrollDisableBlockedByArtifacts(false, false)).toBe(false);
    });
    it("is true when either exists", () => {
      expect(payrollDisableBlockedByArtifacts(true, false)).toBe(true);
      expect(payrollDisableBlockedByArtifacts(false, true)).toBe(true);
    });
  });
});
