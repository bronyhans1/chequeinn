import express from "express";
import cors from "cors";
import { supabaseAdmin } from "./config/supabase";
import { authMiddleware } from "./middleware/auth.middleware";
import { enforceAccountNotBlocked } from "./middleware/accountAccess.middleware";
import { contextMiddleware } from "./middleware/context.middleware";
import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import sessionsRoutes from "./modules/sessions/sessions.routes";
import departmentsRoutes from "./modules/departments/departments.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import shiftsRoutes from "./modules/shifts/shifts.routes";
import leaveRoutes from "./modules/leave/leave.routes";
import leaveBalanceRoutes from "./modules/leave/leaveBalance.routes";
import companyPolicyRoutes from "./modules/companyPolicy/companyPolicy.routes";
import holidaysRoutes from "./modules/holidays/holidays.routes";
import payrollReportsRoutes from "./modules/payroll/payrollReports.routes";
import payslipRoutes from "./modules/payroll/payslip.routes";
import wageRatesRoutes from "./modules/wageRates/wageRates.routes";
import payrollExportRoutes from "./modules/payroll/payrollExport.routes";
import payrollExcelExportRoutes from "./modules/payroll/payrollExcelExport.routes";
import payrollApprovalRoutes from "./modules/payroll/payrollApproval.routes";
import auditRoutes from "./modules/audit/audit.routes";
import platformRoutes from "./modules/platform/platform.routes";
import branchesRoutes from "./modules/branches/branches.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import attendanceDayOverridesRoutes from "./modules/attendanceDayOverrides/attendanceDayOverrides.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("*")
    .limit(1);

  if (error) {
    return res.json({
      status: "Backend running 🚀",
      database: "Connection failed ❌",
      error: error.message,
    });
  }

  return res.json({
    status: "Backend running 🚀",
    database: "Connected to Supabase ✅",
  });
});

app.get("/api/health", async (req, res) => {
  const { error } = await supabaseAdmin
    .from("roles")
    .select("*")
    .limit(1);

  if (error) {
    return res.json({
      status: "Backend running 🚀",
      database: "Connection failed ❌",
      error: error.message,
    });
  }

  return res.json({
    status: "Backend running 🚀",
    database: "Connected to Supabase ✅",
  });
});

app.get(
  "/protected",
  authMiddleware,
  enforceAccountNotBlocked,
  contextMiddleware,
  (req, res) => {
    res.json({
      message: "Full context loaded ✅",
      context: (req as any).context,
    });
  }
);

// attach module routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/attendance-day", attendanceDayOverridesRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/leave-balances", leaveBalanceRoutes);
app.use("/api/company-policy", companyPolicyRoutes);
app.use("/api/company-holidays", holidaysRoutes);
app.use("/api/payroll", payrollReportsRoutes);
app.use("/api/payroll", payslipRoutes);
app.use("/api/wage-rates", wageRatesRoutes);
app.use("/api/payroll", payrollExportRoutes);
app.use("/api/payroll", payrollExcelExportRoutes);
app.use("/api/payroll", payrollApprovalRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/platform", platformRoutes);

export default app;