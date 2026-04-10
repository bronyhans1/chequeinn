const legalOrigin = (
  process.env.EXPO_PUBLIC_LEGAL_SITE_ORIGIN ?? "https://chequeinn.com"
).replace(/\/+$/, "");

export const LEGAL_LINKS = {
  terms: `${legalOrigin}/terms`,
  privacy: `${legalOrigin}/privacy`,
} as const;

export const BRAND = {
  appName: "Cheque-Inn",
  supportEmail: "support@chequeinn.com",
} as const;

