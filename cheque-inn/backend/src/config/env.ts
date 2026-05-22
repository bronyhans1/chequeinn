import dotenv from "dotenv";

dotenv.config();

function parseThreshold(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n < 0) return defaultValue;
  return n;
}

function parsePort(): number {
  const raw = process.env.PORT ?? "5000";
  const n = parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return 5000;
  return n;
}

function parseBool(key: string, defaultValue: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

const nodeEnv = (process.env.NODE_ENV ?? "development").trim() || "development";
const isProduction = nodeEnv === "production";

export const ENV = {
  NODE_ENV: nodeEnv,
  isProduction,
  isDevelopment: !isProduction,
  PORT: parsePort(),
  SUPABASE_URL: (process.env.SUPABASE_URL ?? "").trim(),
  SUPABASE_SERVICE_ROLE_KEY: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim(),
  SUPABASE_ANON_KEY: (process.env.SUPABASE_ANON_KEY ?? "").trim(),
  /** Comma-separated browser origins (web). Mobile native apps omit Origin. */
  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS ?? "").trim(),
  /** Behind Render/Heroku/nginx — required for correct client IP + rate limits. */
  TRUST_PROXY: parseBool("TRUST_PROXY", isProduction),
  /** Verbose request/security logs (never log tokens). */
  REQUEST_LOG_ENABLED: parseBool("REQUEST_LOG_ENABLED", !isProduction),
  REPEATED_LATE_THRESHOLD: parseThreshold("REPEATED_LATE_THRESHOLD", 3),
  REPEATED_EARLY_LEAVE_THRESHOLD: parseThreshold("REPEATED_EARLY_LEAVE_THRESHOLD", 3),
  FREQUENT_HALF_DAY_THRESHOLD: parseThreshold("FREQUENT_HALF_DAY_THRESHOLD", 2),
  REPEATED_ABSENCE_THRESHOLD: parseThreshold("REPEATED_ABSENCE_THRESHOLD", 2),
  /** Minutes after expected shift end before forgot-clock-out alert (default 30). */
  NOTIFICATION_FORGOT_CLOCKOUT_GRACE_MINUTES: parseThreshold(
    "NOTIFICATION_FORGOT_CLOCKOUT_GRACE_MINUTES",
    30
  ),
  NOTIFICATION_EMAIL_ENABLED: parseBool("NOTIFICATION_EMAIL_ENABLED", true),
  /** Shared secret for POST /api/internal/jobs/* (Render cron). */
  CRON_SECRET: (process.env.CRON_SECRET ?? "").trim(),
  /** Dev-only: run forgot-clock-out on interval (ms). 0 = disabled. */
  INTERNAL_JOB_INTERVAL_MS: parseThreshold("INTERNAL_JOB_INTERVAL_MS", 0),
  SMTP_HOST: (process.env.SMTP_HOST ?? "").trim(),
  SMTP_PORT: parseThreshold("SMTP_PORT", 587),
  SMTP_SECURE: parseBool("SMTP_SECURE", false),
  SMTP_USER: (process.env.SMTP_USER ?? "").trim(),
  SMTP_PASS: (process.env.SMTP_PASS ?? "").trim(),
  SMTP_FROM: (process.env.SMTP_FROM ?? "Cheque-Inn <noreply@cheque-inn.local>").trim(),
};

export function isSmtpConfigured(): boolean {
  return Boolean(ENV.SMTP_HOST);
}

const warnings: string[] = [];

function requireNonEmpty(name: string, value: string): void {
  if (!value) {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }
}

function warn(msg: string): void {
  warnings.push(msg);
  console.warn(`[env] ${msg}`);
}

/**
 * Fail fast on boot when required secrets/config are missing or unsafe for production.
 */
export function validateEnvAtStartup(): void {
  if (process.env.JEST_WORKER_ID !== undefined || process.env.SKIP_ENV_VALIDATION === "1") {
    return;
  }
  requireNonEmpty("SUPABASE_URL", ENV.SUPABASE_URL);
  requireNonEmpty("SUPABASE_SERVICE_ROLE_KEY", ENV.SUPABASE_SERVICE_ROLE_KEY);
  requireNonEmpty("SUPABASE_ANON_KEY", ENV.SUPABASE_ANON_KEY);

  try {
    new URL(ENV.SUPABASE_URL);
  } catch {
    throw new Error("[env] SUPABASE_URL must be a valid URL");
  }

  if (ENV.SUPABASE_SERVICE_ROLE_KEY.length < 20) {
    throw new Error("[env] SUPABASE_SERVICE_ROLE_KEY looks invalid (too short)");
  }

  if (ENV.isProduction) {
    if (!ENV.CORS_ALLOWED_ORIGINS) {
      throw new Error(
        "[env] CORS_ALLOWED_ORIGINS is required in production (comma-separated web origins)"
      );
    }
    if (ENV.CORS_ALLOWED_ORIGINS.includes("*")) {
      throw new Error("[env] CORS_ALLOWED_ORIGINS must not contain '*' in production");
    }
    if (!ENV.TRUST_PROXY) {
      warn("TRUST_PROXY is false in production — rate limits and IPs may be wrong behind a load balancer");
    }
  } else {
    if (!ENV.CORS_ALLOWED_ORIGINS) {
      warn(
        "CORS_ALLOWED_ORIGINS unset — using localhost dev defaults. Set explicitly for staging."
      );
    }
  }

  if (warnings.length > 0 && ENV.isProduction) {
    console.warn(`[env] ${warnings.length} configuration warning(s) — review before go-live`);
  }
}

if (process.env.JEST_WORKER_ID === undefined && process.env.SKIP_ENV_VALIDATION !== "1") {
  validateEnvAtStartup();
}
