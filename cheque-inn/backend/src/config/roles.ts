/**
 * Canonical role model for Cheque-Inn.
 *
 * Platform-level:
 * - PLATFORM_ADMIN
 *
 * Company-level:
 * - admin, manager, HR, employee
 *
 * Legacy DB values are normalized to these canonical roles so the app
 * continues to work during migration.
 */

export const PLATFORM_ADMIN = "PLATFORM_ADMIN";

export const CANONICAL_COMPANY_ROLES = ["admin", "manager", "HR", "employee"] as const;
export const CANONICAL_ROLES = [PLATFORM_ADMIN, ...CANONICAL_COMPANY_ROLES] as const;
export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_ROLES);

/** Legacy role name -> canonical role name (lowercase keys for case-insensitive match). */
const LEGACY_TO_CANONICAL: Record<string, CanonicalRole> = {
  super_admin: PLATFORM_ADMIN,
  employee: "employee",
  hr: "HR",
  admin: "admin",
  manager: "manager",
};

/**
 * Normalizes raw role names from the database to canonical roles.
 * Supports legacy values (e.g. SUPER_ADMIN, EMPLOYEE) during migration.
 * Returns a deduplicated array of canonical role strings.
 */
export function normalizeRoles(raw: string[]): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    if (typeof r !== "string" || !r.trim()) continue;
    const key = r.trim().toLowerCase();
    const canonical =
      LEGACY_TO_CANONICAL[key] ?? (CANONICAL_SET.has(r.trim()) ? r.trim() : null);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
}
