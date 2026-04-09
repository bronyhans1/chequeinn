import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export interface MeResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  phone_number?: string | null;
  profile_photo_url?: string | null;
  must_change_password?: boolean;
  theme_preference?: "light" | "dark" | "system";
  department?: { id: string; name: string } | null;
  profile_completion?: {
    required_complete: boolean;
    missing_required_fields: string[];
    recommended_missing_fields: string[];
  };
  company: {
    id: string;
    name: string;
    /** Present when `companies.branch_name` exists in DB; otherwise omitted/null. */
    branch_name?: string | null;
    /** From `company_policies.payroll_enabled`; default true when no policy row. */
    payroll_enabled: boolean;
    /** IANA zone from `company_policies.business_timezone` (earnings / “today”). */
    business_timezone: string;
    /** `companies.status`: active | inactive | suspended */
    status: "active" | "inactive" | "suspended";
  };
  /** `users.status`: active | inactive | suspended */
  status: "active" | "inactive" | "suspended";
  /** User's branch from `users.branch_id` + `branches` (Phase 1). */
  branch: { id: string; name: string } | null;
  roles: string[];
}


