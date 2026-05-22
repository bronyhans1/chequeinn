import { RELEASE, VERSION_LABEL } from "./release";

export const BRAND = {
  appName: RELEASE.productName,
  supportEmail: "support@chequeinn.com",
  version: RELEASE.version,
  versionLabel: VERSION_LABEL,
} as const;

/** Relative routes on the web app; mobile opens absolute URLs from `LEGAL_LINKS` in mobile branding. */
export const LEGAL_ROUTES = {
  terms: "/terms",
  privacy: "/privacy",
} as const;

