import { Response } from "express";
import { supabaseAdmin } from "../../config/supabase";
import { normalizeRoles } from "../../config/roles";
import { AuthenticatedRequest, MeResponse } from "../../types/auth";
import { normalizeAccountStatus } from "../../lib/accountStatus";
import { normalizeBusinessTimeZone } from "../../lib/businessCalendar";
import { roleNamesFromUserRolesJoin } from "../../lib/supabaseRoleJoin";


const EMPTY_COMPANY: MeResponse["company"] = {
  id: "",
  name: "",
  branch_name: null,
  payroll_enabled: true,
  business_timezone: "UTC",
  status: "active",
};

type ThemePreference = "light" | "dark" | "system";
type GenderValue = "male" | "female" | "other" | "prefer_not_to_say";
const ALLOWED_GENDERS = new Set<GenderValue>([
  "male",
  "female",
  "other",
  "prefer_not_to_say",
]);
const ALLOWED_THEMES = new Set<ThemePreference>(["light", "dark", "system"]);

function trimUnknown(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function normalizeOptionalDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return v;
}

async function buildMeResponse(
  userId: string,
  userEmailFallback?: string
): Promise<{ data?: MeResponse; error?: string; status?: number }> {
  // Fetch roles first so we can support PLATFORM_ADMIN with no users row
  const { data: rolesData, error: rolesErr } = await supabaseAdmin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);

  if (rolesErr) return { error: "Failed to load roles", status: 500 };

  const rawRoles = roleNamesFromUserRolesJoin(rolesData ?? null);
  const roles = normalizeRoles(rawRoles);

  if (roles.length === 0) {
    return { error: "User roles not assigned", status: 404 };
  }

  const isPlatformAdmin = roles.includes("PLATFORM_ADMIN");

  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select(
      "id, email, first_name, last_name, company_id, branch_id, date_of_birth, gender, phone_number, profile_photo_url, must_change_password, theme_preference, department_id, status"
    )
    .eq("id", userId)
    .maybeSingle();

  if (userErr) return { error: "Failed to load user", status: 500 };

  if (!user) {
    if (!isPlatformAdmin) {
      return { error: "User not found", status: 404 };
    }
    return {
      data: {
        id: userId,
        email: userEmailFallback ?? "",
        first_name: "",
        last_name: "",
        company: { ...EMPTY_COMPANY },
        branch: null,
        department: null,
        roles,
        date_of_birth: null,
        gender: null,
        phone_number: null,
        profile_photo_url: null,
        must_change_password: false,
        theme_preference: "system",
        status: "active",
        profile_completion: {
          required_complete: true,
          missing_required_fields: [],
          recommended_missing_fields: [],
        },
      },
    };
  }

  let company = EMPTY_COMPANY;
  let branchOut: { id: string; name: string } | null = null;
  let departmentOut: { id: string; name: string } | null = null;

  if (user.company_id) {
    const { data: companyRow, error: compErr } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", user.company_id)
      .maybeSingle();

    if (!compErr && companyRow) {
      const row = companyRow as {
        id: string;
        name: string;
        branch_name?: string | null;
        status?: string | null;
      };
      const legacyBranchName =
        typeof row.branch_name === "string" && row.branch_name.trim()
          ? row.branch_name.trim()
          : null;
      company = {
        id: row.id,
        name: row.name ?? "",
        branch_name: legacyBranchName,
        payroll_enabled: true,
        business_timezone: "UTC",
        status: normalizeAccountStatus(row.status),
      };
    }
  }

  if (user.branch_id) {
    const { data: br, error: brErr } = await supabaseAdmin
      .from("branches")
      .select("id, name")
      .eq("id", user.branch_id)
      .maybeSingle();
    if (!brErr && br && typeof (br as { id?: string }).id === "string") {
      const b = br as { id: string; name: string };
      branchOut = { id: b.id, name: b.name ?? "" };
      if (company.id) {
        company = { ...company, branch_name: b.name ?? company.branch_name ?? null };
      }
    }
  }

  if (user.department_id) {
    const { data: dept, error: deptErr } = await supabaseAdmin
      .from("departments")
      .select("id, name")
      .eq("id", user.department_id)
      .maybeSingle();
    if (!deptErr && dept && typeof (dept as { id?: string }).id === "string") {
      const d = dept as { id: string; name: string };
      departmentOut = { id: d.id, name: d.name ?? "" };
    }
  }

  let payrollEnabled = true;
  let businessTimezone = "UTC";
  if (user.company_id) {
    const { data: pol } = await supabaseAdmin
      .from("company_policies")
      .select("payroll_enabled, business_timezone")
      .eq("company_id", user.company_id)
      .maybeSingle();
    if (pol && typeof (pol as { payroll_enabled?: boolean }).payroll_enabled === "boolean") {
      payrollEnabled = (pol as { payroll_enabled: boolean }).payroll_enabled;
    }
    if (pol && typeof (pol as { business_timezone?: string | null }).business_timezone === "string") {
      businessTimezone = normalizeBusinessTimeZone(
        (pol as { business_timezone: string }).business_timezone
      );
    }
  }
  company = { ...company, payroll_enabled: payrollEnabled, business_timezone: businessTimezone };

  const missingRequiredFields: string[] = [];
  if (user.must_change_password) missingRequiredFields.push("password");
  if (!user.date_of_birth) missingRequiredFields.push("date_of_birth");

  const recommendedMissingFields: string[] = [];
  if (!user.phone_number) recommendedMissingFields.push("phone_number");
  if (!user.gender) recommendedMissingFields.push("gender");
  if (!user.profile_photo_url) recommendedMissingFields.push("profile_photo_url");

  return {
    data: {
      id: user.id,
      email: user.email ?? userEmailFallback ?? "",
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      date_of_birth: user.date_of_birth ?? null,
      gender: user.gender ?? null,
      phone_number: user.phone_number ?? null,
      profile_photo_url: user.profile_photo_url ?? null,
      must_change_password: !!user.must_change_password,
      theme_preference: (user.theme_preference ?? "system") as ThemePreference,
      status: normalizeAccountStatus(
        (user as { status?: string | null }).status
      ),
      company,
      branch: branchOut,
      department: departmentOut,
      roles,
      profile_completion: {
        required_complete: missingRequiredFields.length === 0,
        missing_required_fields: missingRequiredFields,
        recommended_missing_fields: recommendedMissingFields,
      },
    },
  };
}

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = await buildMeResponse(req.user.id, req.user.email);
    if (!payload.data) {
      return res.status(payload.status ?? 500).json({ error: payload.error ?? "Internal server error" });
    }
    return res.json(payload.data);
  } catch (err) {
    console.error("/api/auth/me error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateMyProfile = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.id;

    const updates: Record<string, unknown> = {};
    const firstName = trimUnknown(req.body?.first_name);
    const lastName = trimUnknown(req.body?.last_name);
    const phoneNumber = trimUnknown(req.body?.phone_number);
    const profilePhotoUrl = trimUnknown(req.body?.profile_photo_url);
    const dateOfBirth = normalizeOptionalDate(req.body?.date_of_birth);

    if (req.body?.first_name !== undefined) {
      if (!firstName) return res.status(400).json({ error: "first_name cannot be empty" });
      updates.first_name = firstName;
    }
    if (req.body?.last_name !== undefined) {
      if (!lastName) return res.status(400).json({ error: "last_name cannot be empty" });
      updates.last_name = lastName;
    }
    if (req.body?.phone_number !== undefined) {
      updates.phone_number = phoneNumber ?? null;
    }
    if (req.body?.profile_photo_url !== undefined) {
      updates.profile_photo_url = profilePhotoUrl ?? null;
    }
    if (req.body?.date_of_birth !== undefined) {
      if (dateOfBirth === undefined) {
        return res.status(400).json({ error: "date_of_birth must be YYYY-MM-DD or null" });
      }
      updates.date_of_birth = dateOfBirth;
    }
    if (req.body?.gender !== undefined) {
      const rawGender = req.body.gender;
      if (rawGender === null || rawGender === "") {
        updates.gender = null;
      } else if (typeof rawGender === "string" && ALLOWED_GENDERS.has(rawGender as GenderValue)) {
        updates.gender = rawGender;
      } else {
        return res.status(400).json({
          error: "gender must be one of: male, female, other, prefer_not_to_say, or null",
        });
      }
    }
    if (req.body?.theme_preference !== undefined) {
      const t = trimUnknown(req.body.theme_preference);
      if (!t || !ALLOWED_THEMES.has(t as ThemePreference)) {
        return res.status(400).json({ error: "theme_preference must be one of: light, dark, system" });
      }
      updates.theme_preference = t;
    }
    if (req.body?.department_id !== undefined) {
      const rawDepartmentId = trimUnknown(req.body.department_id);
      if (!rawDepartmentId) {
        updates.department_id = null;
      } else {
        const { data: me, error: meErr } = await supabaseAdmin
          .from("users")
          .select("company_id, branch_id")
          .eq("id", userId)
          .single();
        if (meErr || !me) return res.status(404).json({ error: "User not found" });

        const { data: dept, error: deptErr } = await supabaseAdmin
          .from("departments")
          .select("id, company_id, branch_id")
          .eq("id", rawDepartmentId)
          .single();
        if (deptErr || !dept) return res.status(400).json({ error: "department_id is invalid" });
        if (dept.company_id !== me.company_id || dept.branch_id !== me.branch_id) {
          return res.status(400).json({ error: "department_id must belong to your current branch" });
        }
        updates.department_id = rawDepartmentId;
      }
    }

    if (Object.keys(updates).length === 0) {
      const payload = await buildMeResponse(userId, req.user.email);
      if (!payload.data) {
        return res.status(payload.status ?? 500).json({ error: payload.error ?? "Internal server error" });
      }
      return res.json(payload.data);
    }

    const { error: upErr } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", userId);
    if (upErr) return res.status(500).json({ error: "Failed to update profile" });

    const payload = await buildMeResponse(userId, req.user.email);
    if (!payload.data) {
      return res.status(payload.status ?? 500).json({ error: payload.error ?? "Internal server error" });
    }
    return res.json(payload.data);
  } catch (err) {
    console.error("/api/auth/profile PATCH error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const markPasswordChanged = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.user.id;
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, must_change_password")
      .eq("id", userId)
      .maybeSingle();
    if (userErr) return res.status(500).json({ error: "Failed to read password status" });
    if (!userRow) return res.status(404).json({ error: "User not found" });
    if (!userRow.must_change_password) {
      return res.status(409).json({ error: "Password status is already up to date" });
    }
    const { error } = await supabaseAdmin
      .from("users")
      .update({ must_change_password: false })
      .eq("id", userId);
    if (error) return res.status(500).json({ error: "Failed to update password status" });
    return res.json({ success: true });
  } catch (err) {
    console.error("/api/auth/password-changed error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

