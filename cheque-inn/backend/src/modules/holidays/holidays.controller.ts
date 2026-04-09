import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as holidaysService from "./holidays.service";
import * as holidaysRepo from "./holidays.repository";
import { logAction } from "../audit/audit.service";
import * as salaryResync from "../payroll/salaryEarnings.resync";

export async function listHolidays(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      res.status(400).json({ success: false, error: "year is required" });
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: "month is required (1-12)" });
      return;
    }
    const rows = await holidaysService.listHolidays(companyId, year, month);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("listHolidays error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function createHoliday(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const result = await holidaysService.createHoliday(companyId, req.body ?? {});
    if (result.error || !result.data) {
      res.status(400).json({ success: false, error: result.error ?? "Failed" });
      return;
    }
    try {
      await logAction(companyId, userId, "company_holiday_created", "company_holiday", result.data.id, {
        holiday_date: result.data.holiday_date,
        name: result.data.name,
        is_paid: result.data.is_paid,
      });
    } catch (e) {
      console.error("audit holiday create", e);
    }
    salaryResync.scheduleCompanyMonthlySalaryResyncForHolidayDate(
      companyId,
      result.data.holiday_date.slice(0, 10)
    );
    res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error("createHoliday error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function deleteHoliday(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const id = routeParamString(req.params.id) ?? "";
    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }
    const result = await holidaysService.deleteHoliday(id, companyId);
    if (!result.ok) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }
    try {
      await logAction(companyId, userId, "company_holiday_deleted", "company_holiday", id, {});
    } catch (e) {
      console.error("audit holiday delete", e);
    }
    if (result.deleted) {
      salaryResync.scheduleCompanyMonthlySalaryResyncForHolidayDate(
        companyId,
        result.deleted.holiday_date.slice(0, 10)
      );
    }
    res.json({ success: true, data: null });
  } catch (err) {
    console.error("deleteHoliday error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function updateHoliday(req: ContextRequest, res: Response): Promise<void> {
  try {
    const { companyId, userId } = getRequiredCompanyContext(req);
    const id = routeParamString(req.params.id) ?? "";
    if (!id) {
      res.status(400).json({ success: false, error: "id is required" });
      return;
    }
    const prior = await holidaysRepo.getHolidayById(id, companyId);
    if (!prior) {
      res.status(404).json({ success: false, error: "Holiday not found" });
      return;
    }
    const result = await holidaysService.updateHoliday(companyId, id, req.body ?? {});
    if (result.error || !result.data) {
      res.status(400).json({ success: false, error: result.error ?? "Failed" });
      return;
    }
    try {
      await logAction(companyId, userId, "company_holiday_updated", "company_holiday", id, {
        prior_date: prior.holiday_date,
        holiday_date: result.data.holiday_date,
        is_paid: result.data.is_paid,
      });
    } catch (e) {
      console.error("audit holiday update", e);
    }
    const prevYmd = prior.holiday_date.slice(0, 10);
    const nextYmd = result.data.holiday_date.slice(0, 10);
    const dateChanged = prevYmd !== nextYmd;
    const paidChanged = prior.is_paid !== result.data.is_paid;
    if (dateChanged) {
      salaryResync.scheduleCompanyMonthlySalaryResyncForHolidayMove(companyId, prevYmd, nextYmd);
    } else if (paidChanged) {
      salaryResync.scheduleCompanyMonthlySalaryResyncForHolidayDate(companyId, nextYmd);
    }
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("updateHoliday error", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
