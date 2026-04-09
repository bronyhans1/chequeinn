import { Router } from "express";
import { getProfile, updateMyProfile, markPasswordChanged } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { enforceAccountNotBlocked } from "../../middleware/accountAccess.middleware";
import { createRateLimit } from "../../middleware/rateLimit.middleware";

const router = Router();

// GET /api/auth/me
router.get("/me", authMiddleware, enforceAccountNotBlocked, getProfile);
router.patch("/profile", authMiddleware, enforceAccountNotBlocked, updateMyProfile);
router.post(
  "/password-changed",
  authMiddleware,
  enforceAccountNotBlocked,
  createRateLimit({ keyPrefix: "auth:password-changed", windowMs: 60_000, max: 5 }),
  markPasswordChanged
);

export default router;
