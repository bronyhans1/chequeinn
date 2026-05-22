import type { HelmetOptions } from "helmet";
import { ENV } from "./env";

/** Parse comma-separated origins; trim; drop empties. */
export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

export function defaultDevOrigins(): string[] {
  return [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
  ];
}

export function resolveCorsAllowedOrigins(): string[] {
  const fromEnv = parseAllowedOrigins(ENV.CORS_ALLOWED_ORIGINS);
  if (fromEnv.length > 0) return fromEnv;
  if (ENV.isProduction) return [];
  return defaultDevOrigins();
}

export function isOriginAllowed(
  origin: string | undefined,
  allowed: string[]
): boolean {
  // Native mobile / curl / server-to-server — no Origin header
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  // Expo web dev (exp://) — dev only (read NODE_ENV at call time for tests)
  const isProd = process.env.NODE_ENV === "production";
  if (
    !isProd &&
    (origin.startsWith("exp://") || origin.startsWith("http://localhost:"))
  ) {
    return true;
  }
  return false;
}

function supabaseOrigins(): string[] {
  const out: string[] = [];
  try {
    if (ENV.SUPABASE_URL) {
      const u = new URL(ENV.SUPABASE_URL);
      out.push(u.origin);
      out.push(`wss://${u.host}`);
    }
  } catch {
    /* validated at startup */
  }
  return out;
}

/** Helmet + CSP-Report-Only (not enforced). Safe for API + Supabase auth redirects in browsers. */
export function buildHelmetOptions(): HelmetOptions {
  const frontendOrigins = resolveCorsAllowedOrigins();
  const connectSrc = [
    "'self'",
    ...supabaseOrigins(),
    ...frontendOrigins,
  ];

  const base: HelmetOptions = {
    frameguard: { action: "deny" },
    xContentTypeOptions: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      useDefaults: false,
      reportOnly: true,
      directives: {
        defaultSrc: ["'none'"],
        connectSrc,
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", ...supabaseOrigins()],
      },
    },
  };

  if (ENV.isProduction) {
    base.strictTransportSecurity = {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: false,
    };
  } else {
    base.strictTransportSecurity = false;
  }

  return base;
}
