import type { AppRole } from "@/types/auth";

const CANONICAL_APP_ROLES: AppRole[] = ["admin", "manager", "HR", "employee", "PLATFORM_ADMIN"];
const CANONICAL_SET = new Set<string>(CANONICAL_APP_ROLES);

const LEGACY_TO_CANONICAL: Record<string, AppRole> = {
  super_admin: "PLATFORM_ADMIN",
  employee: "employee",
  hr: "HR",
  admin: "admin",
  manager: "manager",
};

export function normalizeRolesForApp(raw: string[] | undefined): AppRole[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const seen = new Set<string>();
  const out: AppRole[] = [];
  for (const r of raw) {
    if (typeof r !== "string" || !r.trim()) continue;
    const key = r.trim().toLowerCase();
    const canonical: AppRole | null =
      LEGACY_TO_CANONICAL[key] ?? (CANONICAL_SET.has(r.trim()) ? (r.trim() as AppRole) : null);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
}

export function isPlatformAdmin(roles: AppRole[] | undefined): boolean {
  if (!roles?.length) return false;
  return roles.includes("PLATFORM_ADMIN");
}

export function hasRole(userRoles: AppRole[] | undefined, allowed: AppRole[]): boolean {
  if (!userRoles?.length) return false;
  return userRoles.some((r) => allowed.includes(r));
}
