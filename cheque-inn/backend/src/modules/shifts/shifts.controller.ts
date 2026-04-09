import { Response } from "express";
import { ContextRequest } from "../../middleware/context.middleware";
import { getRequiredCompanyContext } from "../../lib/companyRequestContext";
import { routeParamString } from "../../lib/routeParams";
import * as shiftsService from "./shifts.service";

export async function createShift(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const { name, start_time, end_time, grace_minutes } = req.body || {};

    const result = await shiftsService.createShift(companyId, {
      name,
      start_time,
      end_time,
      grace_minutes,
    });

    if (result.error) {
      res
        .status(400)
        .json({ success: false, error: result.error });
      return;
    }

    res
      .status(201)
      .json({ success: true, data: result.data });
  } catch (err) {
    console.error("createShift error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function getShifts(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const result = await shiftsService.getShifts(companyId);

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("getShifts error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function updateShift(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const id = routeParamString(req.params.id);
    const { name, start_time, end_time, grace_minutes } = req.body || {};

    if (!id) {
      res.status(400).json({ success: false, error: "Shift id is required" });
      return;
    }

    const result = await shiftsService.updateShift(id, companyId, {
      name,
      start_time,
      end_time,
      grace_minutes,
    });

    if (result.error) {
      res
        .status(result.error === "Shift not found" ? 404 : 400)
        .json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("updateShift error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

export async function deleteShift(
  req: ContextRequest,
  res: Response
): Promise<void> {
  try {
    const { companyId } = getRequiredCompanyContext(req);
    const shiftId = routeParamString(req.params.shiftId);

    if (!shiftId) {
      res.status(400).json({ success: false, error: "shiftId is required" });
      return;
    }

    const result = await shiftsService.deleteShift(shiftId, companyId);

    if (result.error) {
      res
        .status(404)
        .json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("deleteShift error", err);
    res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}

