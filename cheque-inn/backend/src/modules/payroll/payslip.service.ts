import PDFDocument from "pdfkit";
import { supabaseAdmin } from "../../config/supabase";
import * as payrollRepo from "./payroll.repository";
import * as usersRepo from "../users/users.repository";
import * as companyPolicyService from "../companyPolicy/companyPolicy.service";

export interface PayslipResult {
  buffer: Buffer;
}

export async function generatePayslip(
  payrollId: string,
  companyId: string
): Promise<{ buffer: Buffer } | null> {
  const payroll = await payrollRepo.getPayrollById(payrollId);
  if (!payroll || payroll.company_id !== companyId) {
    return null;
  }

  const user = await usersRepo.findByIdAndCompanyId(payroll.user_id, companyId);
  if (!user) {
    return null;
  }

  const { data: companyRow } = await supabaseAdmin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  const companyName =
    (companyRow as { name?: string } | null)?.name ?? "Company";

  const policy = await companyPolicyService.getPolicy(companyId);
  const multiplier = policy?.overtime_multiplier ?? 1.5;

  const regularPay =
    (payroll.regular_minutes / 60) * payroll.hourly_rate;
  const overtimePay =
    (payroll.overtime_minutes / 60) *
    payroll.hourly_rate *
    multiplier;

  const lateBreak = payrollRepo.payrollRecordEarningsBreakdown(payroll);

  const buffer = await buildPdf({
    companyName,
    employeeName: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Employee",
    payrollDate: payroll.payroll_date,
    regularMinutes: payroll.regular_minutes,
    overtimeMinutes: payroll.overtime_minutes,
    hourlyRate: payroll.hourly_rate,
    regularPay,
    overtimePay,
    grossEarnings: payroll.gross_earnings,
    baseBeforeLate: lateBreak.baseBeforeLate,
    lateDeduction: lateBreak.lateDeduction,
  });

  return { buffer };
}

function buildPdf(params: {
  companyName: string;
  employeeName: string;
  payrollDate: string;
  regularMinutes: number;
  overtimeMinutes: number;
  hourlyRate: number;
  regularPay: number;
  overtimePay: number;
  grossEarnings: number;
  baseBeforeLate: number;
  lateDeduction: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Payslip", { align: "center" });
    doc.moveDown();

    doc.fontSize(12);
    doc.text(`Company: ${params.companyName}`);
    doc.text(`Employee: ${params.employeeName}`);
    doc.text(`Payroll date: ${params.payrollDate}`);
    doc.moveDown();

    doc.text(`Regular minutes: ${params.regularMinutes}`);
    doc.text(`Overtime minutes: ${params.overtimeMinutes}`);
    doc.text(`Hourly rate: ${params.hourlyRate.toFixed(2)}`);
    doc.moveDown();

    doc.text(`Regular pay: ${params.regularPay.toFixed(2)}`);
    doc.text(`Overtime pay: ${params.overtimePay.toFixed(2)}`);
    if (params.lateDeduction > 0) {
      doc.moveDown(0.25);
      doc
        .fontSize(12)
        .text(`Earnings before late deduction: ${params.baseBeforeLate.toFixed(2)}`);
      doc.text(`Late pay deduction: -${params.lateDeduction.toFixed(2)}`);
      doc.moveDown(0.25);
      doc.fontSize(14).text(`Net earnings (payable): ${params.grossEarnings.toFixed(2)}`, {
        continued: false,
      });
    } else {
      doc.fontSize(14).text(`Gross earnings: ${params.grossEarnings.toFixed(2)}`, {
        continued: false,
      });
    }

    doc.end();
  });
}
