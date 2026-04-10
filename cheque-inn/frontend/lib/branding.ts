import pkg from "../package.json";

export const BRAND = {
  appName: "Cheque-Inn",
  supportEmail: "support@chequeinn.com",
  version: typeof pkg.version === "string" ? pkg.version : "0.0.0",
} as const;

/** Relative routes on the web app; mobile opens absolute URLs from `LEGAL_LINKS` in mobile branding. */
export const LEGAL_ROUTES = {
  terms: "/terms",
  privacy: "/privacy",
} as const;

