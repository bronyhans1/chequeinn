/**
 * Rule: turning payroll OFF is blocked once the company has payroll rows or any wage_rates row
 * (salary/hourly assignments). Enabling payroll is always allowed.
 */
export function messageIfCannotDisablePayroll(params: {
  requestedPayrollEnabled: boolean | undefined;
  currentPayrollEnabled: boolean;
  hasPayrollRecords: boolean;
  hasWageRateRows: boolean;
}): string | null {
  if (params.requestedPayrollEnabled !== false) return null;
  if (!params.currentPayrollEnabled) return null;
  if (!params.hasPayrollRecords && !params.hasWageRateRows) return null;
  return "Payroll cannot be turned off after payroll data or salary assignments already exist for this company.";
}

export function payrollDisableBlockedByArtifacts(
  hasPayrollRecords: boolean,
  hasWageRateRows: boolean
): boolean {
  return hasPayrollRecords || hasWageRateRows;
}
