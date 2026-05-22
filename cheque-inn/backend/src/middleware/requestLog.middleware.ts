import { Request, Response, NextFunction } from "express";
import { ENV } from "../config/env";

const SENSITIVE_PATH_PREFIXES = ["/api/auth", "/api/sessions/clock"];

function redactPath(path: string): string {
  return path.split("?")[0];
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].trim();
  }
  return req.ip ?? "unknown";
}

/**
 * Lightweight operational logging — never logs Authorization or body secrets.
 */
export function requestLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!ENV.REQUEST_LOG_ENABLED) {
    next();
    return;
  }

  const start = Date.now();
  const path = redactPath(req.originalUrl || req.url);
  const method = req.method;

  res.on("finish", () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const userId = (req as { context?: { userId?: string } }).context?.userId;
    const userPart = userId ? ` user=${userId.slice(0, 8)}…` : "";
    const ip = clientIp(req);

    const line = `[req] ${method} ${path} ${status} ${ms}ms ip=${ip}${userPart}`;

    if (status === 401 || status === 403) {
      console.warn(`[security] ${line}`);
      return;
    }
    if (status === 429) {
      console.warn(`[security] rate_limited ${line}`);
      return;
    }
    if (status >= 500) {
      console.error(`[security] server_error ${line}`);
      return;
    }
    if (ms > 5000) {
      console.warn(`[security] slow_request ${line}`);
    }

    const isSensitive = SENSITIVE_PATH_PREFIXES.some((p) => path.startsWith(p));
    if (!isSensitive && status < 400) {
      console.log(line);
    } else if (status >= 400 && status < 500) {
      console.warn(line);
    }
  });

  next();
}

/** Log operational domain events (payroll sync, overnight calc) — call from services. */
export function logOperationalEvent(
  category: "payroll_sync" | "overnight" | "auth" | "security",
  message: string,
  meta?: Record<string, string | number | boolean | null | undefined>
): void {
  const safeMeta = meta
    ? Object.entries(meta)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(" ")
    : "";
  console.warn(`[ops:${category}] ${message}${safeMeta ? ` ${safeMeta}` : ""}`);
}
