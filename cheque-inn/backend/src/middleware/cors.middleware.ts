import cors from "cors";
import { ENV } from "../config/env";
import { isOriginAllowed, resolveCorsAllowedOrigins } from "../config/security";

/**
 * Explicit origin allowlist. Native mobile / health checks send no Origin (allowed).
 */
export function buildCorsMiddleware() {
  const allowed = resolveCorsAllowedOrigins();

  if (ENV.REQUEST_LOG_ENABLED && allowed.length > 0) {
    console.log(`[cors] Allowed origins (${ENV.NODE_ENV}): ${allowed.join(", ")}`);
  }

  return cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowed)) {
        callback(null, true);
        return;
      }
      if (ENV.REQUEST_LOG_ENABLED) {
        console.warn(`[cors] Blocked origin: ${origin ?? "(none)"}`);
      }
      callback(new Error("CORS: origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  });
}
