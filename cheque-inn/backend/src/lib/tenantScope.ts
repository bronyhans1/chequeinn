import * as usersRepo from "../modules/users/users.repository";

/**
 * Defense-in-depth: ensure a user id belongs to the requester's company before
 * acting on cross-user resources (history, payroll, etc.).
 */
export async function assertUserBelongsToCompany(
  userId: string,
  companyId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const user = await usersRepo.findByIdAndCompanyId(userId, companyId);
  if (!user) {
    return { ok: false, status: 404, message: "User not found" };
  }
  return { ok: true };
}
