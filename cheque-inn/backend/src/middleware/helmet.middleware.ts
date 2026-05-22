import helmet from "helmet";
import { RequestHandler } from "express";
import { buildHelmetOptions } from "../config/security";
import { ENV } from "../config/env";

/** Permissions-Policy (Helmet 8 does not expose a typed helper). */
const permissionsPolicyHeader: RequestHandler = (_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), geolocation=(self), microphone=()"
  );
  next();
};

export function buildHelmetMiddleware(): RequestHandler[] {
  const options = buildHelmetOptions();
  if (ENV.REQUEST_LOG_ENABLED) {
    console.log(
      `[security] Helmet enabled (CSP report-only: ${Boolean(options.contentSecurityPolicy)})`
    );
  }
  return [helmet(options), permissionsPolicyHeader];
}
