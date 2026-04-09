/**
 * Supabase join shape for `user_roles` → `roles(name)` varies in typings (object vs array).
 * Extract canonical role name strings for permission checks.
 */
export function roleNamesFromUserRolesJoin(
  rows: { roles?: unknown }[] | null | undefined
): string[] {
  if (!rows?.length) return [];
  const out: string[] = [];
  for (const r of rows) {
    const role = r.roles as { name?: string } | { name?: string }[] | null | undefined;
    if (Array.isArray(role)) {
      const n = role[0]?.name;
      if (typeof n === "string" && n.length > 0) out.push(n);
    } else if (role && typeof role.name === "string" && role.name.length > 0) {
      out.push(role.name);
    }
  }
  return out;
}
