import * as payrollRepo from "./payroll.repository";

export interface ApprovalResult {
  success: boolean;
  error?: string;
}

export async function approvePayrollRecord(
  id: string,
  companyId: string
): Promise<ApprovalResult> {
  const record = await payrollRepo.getPayrollByIdAndCompany(id, companyId);
  if (!record) {
    return { success: false, error: "Payroll record not found" };
  }
  if (record.status !== "draft") {
    return { success: false, error: "Payroll record is not in draft status" };
  }

  const updated = await payrollRepo.approvePayrollRecord(id, companyId);
  if (!updated) {
    return { success: false, error: "Payroll record not found or not in draft status" };
  }
  return { success: true };
}

export async function lockPayrollRecord(
  id: string,
  companyId: string
): Promise<ApprovalResult> {
  const record = await payrollRepo.getPayrollByIdAndCompany(id, companyId);
  if (!record) {
    return { success: false, error: "Payroll record not found" };
  }
  if (record.status !== "approved") {
    return { success: false, error: "Payroll record must be approved before it can be locked" };
  }

  const updated = await payrollRepo.lockPayrollRecord(id, companyId);
  if (!updated) {
    return { success: false, error: "Payroll record not found or not in approved status" };
  }
  return { success: true };
}
