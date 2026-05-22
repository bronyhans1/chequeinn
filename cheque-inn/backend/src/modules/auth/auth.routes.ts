import { Router } from "express";
import { getProfile, updateMyProfile, markPasswordChanged } from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { enforceAccountNotBlocked } from "../../middleware/accountAccess.middleware";
import { createRateLimit } from "../../middleware/rateLimit.middleware";

const router = Router();

const profileReadLimiter = createRateLimit({
  keyPrefix: "auth:me",
  windowMs: 60_000,
  max: 120,
});

// GET /api/auth/me — generous limit for mobile focus/reconnect refresh
router.get("/me", authMiddleware, profileReadLimiter, enforceAccountNotBlocked, getProfile);
router.patch(
  "/profile",
  authMiddleware,
  createRateLimit({ keyPrefix: "auth:profile-patch", windowMs: 60_000, max: 30 }),
  enforceAccountNotBlocked,
  updateMyProfile
);
router.post(
  "/password-changed",
  authMiddleware,
  enforceAccountNotBlocked,
  createRateLimit({ keyPrefix: "auth:password-changed", windowMs: 60_000, max: 5 }),
  markPasswordChanged
);

export default router;
