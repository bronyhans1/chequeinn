import { Router } from "express";
import { companyApiStack } from "../../middleware/standardGuards";
import { createRateLimit } from "../../middleware/rateLimit.middleware";
import * as controller from "./notifications.controller";

const router = Router();

const readLimiter = createRateLimit({
  keyPrefix: "notifications:read",
  windowMs: 60_000,
  max: 120,
});

router.get("/", ...companyApiStack, readLimiter, controller.listMine);
router.get("/unread-count", ...companyApiStack, readLimiter, controller.unreadCount);
router.patch("/:id/read", ...companyApiStack, readLimiter, controller.markRead);
router.post("/mark-all-read", ...companyApiStack, readLimiter, controller.markAllRead);

export default router;
