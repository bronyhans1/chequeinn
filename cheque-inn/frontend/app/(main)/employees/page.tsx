"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import * as usersApi from "@/lib/api/users.api";
import * as shiftsApi from "@/lib/api/shifts.api";
import * as branchesApi from "@/lib/api/branches.api";
import * as departmentsApi from "@/lib/api/departments.api";
import * as companyPolicyApi from "@/lib/api/companyPolicy.api";
import * as leaveBalancesApi from "@/lib/api/leaveBalances.api";
import { isApiError } from "@/lib/types/api";
import type { CreatableCompanyRole, UserListItem } from "@/lib/api/users.api";
import type { Shift } from "@/lib/api/shifts.api";
import type { BranchDto } from "@/lib/api/branches.api";
import type { Department } from "@/lib/api/departments.api";
import { hasRole, isBranchScopedCompanyUser } from "@/lib/auth/roles";
import * as wageRatesApi from "@/lib/api/wageRates.api";
import type { WageRateRecord, WageRateType } from "@/lib/api/wageRates.api";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiClientError } from "@/lib/api/client";
import { useToast } from "@/components/ui/ToastProvider";
import { ManualAttendanceModal } from "@/components/attendance/ManualAttendanceModal";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import * as dayClassApi from "@/lib/api/attendanceDayClassification.api";

function fullName(row: UserListItem): string {
  const first = row.first_name?.trim() ?? "";
  const last = row.last_name?.trim() ?? "";
  return [first, last].filter(Boolean).join(" ") || "—";
}

function accountStatusBadge(status: UserListItem["status"]) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "inactive") return <Badge variant="default">Inactive</Badge>;
  return <Badge variant="danger">Suspended</Badge>;
}

export default function EmployeesPage() {
  const { user: authUser } = useAuth();
  const toast = useToast();
  /** Only company `admin` may reassign branch from the table (not manager/HR/PLATFORM_ADMIN). */
  const canReassignEmployeeBranch = hasRole(authUser?.roles, ["admin"]);
  const branchScoped = isBranchScopedCompanyUser(authUser?.roles);
  const canDeleteCompanyUsers = hasRole(authUser?.roles, ["admin"]);
  const canAssignDepartment =
    hasRole(authUser?.roles, ["admin"]) || hasRole(authUser?.roles, ["manager"]);
  const canRecordManualAttendance = hasRole(authUser?.roles, ["admin", "manager", "HR"]);
  /** Salary day overrides: API allows admin/HR only; managers must not see this panel. */
  const canManageSalaryDayOverride = hasRole(authUser?.roles, ["admin", "HR"]);
  const canManageCompensation = hasRole(authUser?.roles, ["admin", "HR"]);
  const canChangeUserStatus = hasRole(authUser?.roles, ["admin", "HR"]);
  const canManageLeaveBalances = hasRole(authUser?.roles, ["admin", "HR"]);

  const [users, setUsers] = useState<UserListItem[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [formFirst, setFormFirst] = useState("");
  const [formLast, setFormLast] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<CreatableCompanyRole>("employee");
  const [formBranchId, setFormBranchId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [shiftAssigningId, setShiftAssigningId] = useState<string | null>(null);
  const [branchAssigningId, setBranchAssigningId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [departmentAssigningId, setDepartmentAssigningId] = useState<string | null>(null);
  const [manualAttOpen, setManualAttOpen] = useState(false);
  const [manualAttUserId, setManualAttUserId] = useState<string | null>(null);
  const [detailStatusDraft, setDetailStatusDraft] = useState<UserListItem["status"]>("active");
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const [wageRows, setWageRows] = useState<WageRateRecord[]>([]);
  const [wageLoading, setWageLoading] = useState(false);
  const [wageError, setWageError] = useState<string | null>(null);
  const [wageRateType, setWageRateType] = useState<WageRateType>("hourly");
  const [wageEffectiveFrom, setWageEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [wageHourly, setWageHourly] = useState("");
  const [wageMonthly, setWageMonthly] = useState("");
  const [wageDivisorType, setWageDivisorType] = useState<"dynamic_working_days" | "fixed_days">(
    "dynamic_working_days"
  );
  const [wageDivisorValue, setWageDivisorValue] = useState("30");
  const [wageSaving, setWageSaving] = useState(false);
  const [wageDeleteTarget, setWageDeleteTarget] = useState<WageRateRecord | null>(null);
  const [wageDeleteSubmitting, setWageDeleteSubmitting] = useState(false);
  const [currencyCode, setCurrencyCode] = useState<"GHS" | "USD">("GHS");

  const [leaveBalance, setLeaveBalance] = useState<leaveBalancesApi.LeaveBalanceRecord | null>(null);
  const [leaveBalanceLoading, setLeaveBalanceLoading] = useState(false);
  const [leaveBalanceError, setLeaveBalanceError] = useState<string | null>(null);
  const [leaveTotalDays, setLeaveTotalDays] = useState("");
  const [leaveUsedDays, setLeaveUsedDays] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);

  const [dayOverrideDate, setDayOverrideDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayOverrideUnits, setDayOverrideUnits] = useState<dayClassApi.DayUnits>(0.5);
  const [dayOverrideNote, setDayOverrideNote] = useState("");
  const [dayOverrideLoading, setDayOverrideLoading] = useState(false);
  const [dayOverrideError, setDayOverrideError] = useState<string | null>(null);
  const [dayOverrideInfo, setDayOverrideInfo] = useState<dayClassApi.DayClassificationInfo | null>(null);

  const payrollEnabled = authUser?.payrollEnabled !== false;
  const showCompensationPanel = useMemo(() => {
    if (!payrollEnabled) return false;
    if (!canManageCompensation || !selectedUser || !authUser) return false;
    if (hasRole(authUser.roles, ["admin"])) return true;
    return Boolean(authUser.branch?.id && selectedUser.branch_id === authUser.branch.id);
  }, [payrollEnabled, canManageCompensation, selectedUser, authUser]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [usersRes, shiftsRes, policyRes] = await Promise.all([
        usersApi.getUsers(),
        shiftsApi.getShifts(),
        companyPolicyApi.getPolicy(),
      ]);
      if (isApiError(usersRes)) {
        setError(usersRes.error);
        setUsers([]);
        return;
      }
      setUsers(usersRes.data ?? []);
      if (!isApiError(shiftsRes)) {
        setShifts(shiftsRes.data ?? []);
      }
      if (!isApiError(policyRes)) {
        const cc = policyRes.data?.currency_code;
        if (cc === "USD" || cc === "GHS") setCurrencyCode(cc);
      }
      try {
        const branchesRes = await branchesApi.getBranches();
        if (!isApiError(branchesRes)) {
          setBranches(branchesRes.data ?? []);
        } else {
          setBranches([]);
        }
      } catch {
        setBranches([]);
      }
      try {
        const depRes = await departmentsApi.getDepartments();
        if (!isApiError(depRes)) {
          setDepartments(depRes.data ?? []);
        } else {
          setDepartments([]);
        }
      } catch {
        setDepartments([]);
      }
    } catch (e) {
      const msg =
        e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Failed to load employees";
      setError(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!detailOpen || !selectedUser?.id || !showCompensationPanel) {
      setWageRows([]);
      setWageError(null);
      return;
    }
    let cancelled = false;
    setWageLoading(true);
    setWageError(null);
    void (async () => {
      const res = await wageRatesApi.getUserWageRates(selectedUser.id);
      if (cancelled) return;
      if (isApiError(res)) {
        setWageError(res.error);
        setWageRows([]);
      } else {
        setWageRows(res.data ?? []);
      }
      setWageLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [detailOpen, selectedUser?.id, showCompensationPanel]);

  useEffect(() => {
    if (!detailOpen || !selectedUser?.id || !canManageLeaveBalances) {
      setLeaveBalance(null);
      setLeaveBalanceError(null);
      setLeaveBalanceLoading(false);
      return;
    }
    let cancelled = false;
    setLeaveBalanceLoading(true);
    setLeaveBalanceError(null);
    void (async () => {
      try {
        const res = await leaveBalancesApi.getUserLeaveBalance(selectedUser.id);
        if (cancelled) return;
        if (isApiError(res)) {
          setLeaveBalance(null);
          setLeaveBalanceError(res.error ?? "Failed to load leave balance");
          return;
        }
        const row = res.data ?? null;
        setLeaveBalance(row);
        setLeaveTotalDays(row ? String(row.total_days) : "");
        setLeaveUsedDays(row ? String(row.used_days) : "");
      } catch (e) {
        if (cancelled) return;
        setLeaveBalance(null);
        setLeaveBalanceError(e instanceof Error ? e.message : "Failed to load leave balance");
      } finally {
        if (!cancelled) setLeaveBalanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailOpen, selectedUser?.id, canManageLeaveBalances]);

  useEffect(() => {
    if (!detailOpen || !selectedUser?.id || !canManageSalaryDayOverride) {
      setDayOverrideInfo(null);
      setDayOverrideError(null);
      return;
    }
    let cancelled = false;
    setDayOverrideLoading(true);
    setDayOverrideError(null);
    void (async () => {
      try {
        const res = await dayClassApi.getDayClassification({
          user_id: selectedUser.id,
          date: dayOverrideDate,
        });
        if (cancelled) return;
        if (isApiError(res)) {
          setDayOverrideInfo(null);
          setDayOverrideError(res.error ?? "Failed to load day classification");
          return;
        }
        setDayOverrideInfo(res.data);
      } catch (e) {
        if (cancelled) return;
        setDayOverrideInfo(null);
        setDayOverrideError(e instanceof Error ? e.message : "Failed to load day classification");
      } finally {
        if (!cancelled) setDayOverrideLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailOpen, selectedUser?.id, canManageSalaryDayOverride, dayOverrideDate]);

  async function handleAssignShift(userId: string, shiftId: string | null) {
    setShiftAssigningId(userId);
    try {
      const res = await usersApi.assignShift(userId, shiftId);
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to assign shift";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Employee updated successfully");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to assign shift";
      setError(msg);
      toast.error(msg);
    } finally {
      setShiftAssigningId(null);
    }
  }

  /** Company `admin` only: gated by `canReassignEmployeeBranch` on the column. */
  async function handleAssignBranch(userId: string, branchId: string) {
    setBranchAssigningId(userId);
    setError(null);
    try {
      const res = await usersApi.updateUser(userId, { branch_id: branchId });
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to update branch";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Employee updated successfully");
      await load();
      if (detailOpen && selectedUserId === userId) {
        const refreshed = await usersApi.getUserById(userId);
        if (!isApiError(refreshed) && refreshed.data) {
          setSelectedUser(refreshed.data);
        }
      }
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to update branch"
      );
      toast.error(
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to update branch"
      );
    } finally {
      setBranchAssigningId(null);
    }
  }

  async function handleAssignDepartment(userId: string, departmentId: string | null) {
    setDepartmentAssigningId(userId);
    setDetailError(null);
    try {
      const res = await usersApi.updateUser(userId, { department_id: departmentId });
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to update department";
        setDetailError(msg);
        toast.error(msg);
        return;
      }
      setSelectedUser(res.data);
      setDetailStatusDraft(res.data.status);
      toast.success("Department updated successfully");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update department";
      setDetailError(msg);
      toast.error(msg);
    } finally {
      setDepartmentAssigningId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        fullName(u).toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const defaultBranchIdForForm = useMemo(() => {
    const d = branches.find((b) => b.is_default);
    return d?.id ?? branches[0]?.id ?? "";
  }, [branches]);

  function resetAddEmployeeForm() {
    setFormFirst("");
    setFormLast("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("employee");
    setFormBranchId(defaultBranchIdForForm);
    setFormError(null);
  }

  function closeAddModal() {
    setModalOpen(false);
    resetAddEmployeeForm();
  }

  function openAddModal() {
    resetAddEmployeeForm();
    setModalOpen(true);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const first = formFirst.trim();
    const last = formLast.trim();
    const email = formEmail.trim();
    if (!first || !last || !email) {
      setFormError("First name, last name, and email are required.");
      return;
    }
    if (formPassword.length < 6) {
      setFormError("Temporary password must be at least 6 characters.");
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await usersApi.createUser({
        first_name: first,
        last_name: last,
        email,
        temporary_password: formPassword,
        role: formRole,
        ...(!branchScoped && formBranchId.trim()
          ? { branch_id: formBranchId.trim() }
          : {}),
      });
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to add employee";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      closeAddModal();
      toast.success("Employee added successfully");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add employee";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSubmitting(false);
    }
  }

  const columns = [
    { key: "name", header: "Name", render: (row: UserListItem) => fullName(row) },
    { key: "email", header: "Email" },
    {
      key: "status",
      header: "Status",
      render: (row: UserListItem) => accountStatusBadge(row.status),
    },
    {
      key: "roles",
      header: "Role(s)",
      render: (row: UserListItem) =>
        row.roles?.length ? row.roles.join(", ") : "—",
    },
    {
      key: "branch",
      header: "Branch",
      render: (row: UserListItem) => row.branch?.name ?? "—",
    },
    ...(canReassignEmployeeBranch
      ? [
          {
            key: "branch_assign",
            header: "Assign branch",
            render: (row: UserListItem) => (
              <select
                value={row.branch_id ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val !== row.branch_id) {
                    handleAssignBranch(row.id, val);
                  }
                }}
                disabled={branchAssigningId === row.id}
                className="input-field max-w-[200px] py-1 text-sm disabled:opacity-50"
                aria-label={`Assign branch for ${fullName(row)}`}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
            ),
          },
        ]
      : []),
    {
      key: "view",
      header: "Details",
      render: (row: UserListItem) => (
        <button
          type="button"
          onClick={() => void openDetails(row.id)}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          View
        </button>
      ),
    },
    {
      key: "shift",
      header: "Shift",
      render: (row: UserListItem) => (
          <select
            value={row.shift_id ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              handleAssignShift(row.id, val || null);
            }}
            disabled={shiftAssigningId === row.id}
            className="input-field rounded py-1 text-sm disabled:opacity-50"
            aria-label={`Assign shift for ${fullName(row)}`}
          >
            <option value="">No shift</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.start_time}–{s.end_time})
              </option>
            ))}
          </select>
        ),
    },
  ];

  const selectedName = useMemo(() => {
    if (!selectedUser) return "";
    return fullName(selectedUser);
  }, [selectedUser]);

  const selectedRoleLabel = useMemo(() => {
    if (!selectedUser?.roles?.length) return "—";
    return selectedUser.roles.join(", ");
  }, [selectedUser]);

  const departmentsForSelectedBranch = useMemo(() => {
    if (!selectedUser?.branch_id) return [];
    return departments.filter((d) => d.branch_id === selectedUser.branch_id);
  }, [departments, selectedUser?.branch_id]);

  const selectedCanBeDeleted = useMemo(() => {
    if (!selectedUser || !canDeleteCompanyUsers) return false;
    const targetRoles = selectedUser.roles ?? [];
    const targetIsAdmin = targetRoles.includes("admin");
    const isSelf = selectedUser.id === authUser?.userId;
    return !targetIsAdmin && !isSelf;
  }, [selectedUser, canDeleteCompanyUsers, authUser?.userId]);

  async function openDetails(userId: string) {
    setDetailOpen(true);
    setSelectedUserId(userId);
    setSelectedUser(null);
    setDetailError(null);
    setDetailLoading(true);
    setDeleteConfirmValue("");
    try {
      const res = await usersApi.getUserById(userId);
      if (isApiError(res) || !res.data) {
        setDetailError(isApiError(res) ? res.error : "User not found");
        return;
      }
      setSelectedUser(res.data);
      setDetailStatusDraft(res.data.status);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Failed to load user details");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetails() {
    setDetailOpen(false);
    setSelectedUserId(null);
    setSelectedUser(null);
    setDetailError(null);
    setDeleteConfirmValue("");
  }

  async function handleDeleteUserFromDetails() {
    if (!selectedUser || !selectedCanBeDeleted || !selectedName) return;
    setDeleteSubmitting(true);
    setDetailError(null);
    try {
      const res = await usersApi.deleteUser(selectedUser.id);
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to delete user";
        setDetailError(msg);
        toast.error(msg);
        return;
      }
      closeDetails();
      if (res.data?.outcome === "deactivated_due_to_records") {
        toast.warning(
          res.data.message ??
            "This employee cannot be permanently deleted because historical records exist. The employee has been made inactive instead."
        );
      } else {
        toast.success("The employee has been permanently deleted.");
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete user";
      setDetailError(msg);
      toast.error(msg);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  if (loading && users.length === 0) {
    return (
      <MainContent title="Employees">
        <LoadingState message="Loading employees…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  if (error) {
    return (
      <MainContent title="Employees">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  return (
    <MainContent title="Employees">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-theme-muted">
          {users.length} employee{users.length !== 1 ? "s" : ""}{" "}
          {branchScoped
            ? `in your branch${authUser?.branch?.name ? ` (${authUser.branch.name})` : ""}`
            : "in your company"}
          {search.trim() ? ` (${filtered.length} match search)` : ""}.
        </p>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Add Employee
        </button>
      </div>
      <Card title="Employee list" className="mt-4">
        {users.length > 0 && (
          <div className="mb-4">
            <label htmlFor="employees-search" className="sr-only">
              Search by name or email
            </label>
            <input
              id="employees-search"
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field max-w-sm w-full"
              aria-label="Search by name or email"
            />
          </div>
        )}
        {filtered.length === 0 ? (
          <EmptyState
            message={
              users.length === 0
                ? "No employees yet. Use Add Employee to create one."
                : "No employees match your search."
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            keyExtractor={(row) => row.id}
            emptyMessage="No employees"
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={closeAddModal} title="Add Employee">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="alert-error px-3 py-2">{formError}</div>
          )}
          <div>
            <label htmlFor="add-first-name" className="mb-1 block text-sm font-medium text-theme">
              First Name
            </label>
            <input
              id="add-first-name"
              type="text"
              value={formFirst}
              onChange={(e) => setFormFirst(e.target.value)}
              required
              autoComplete="given-name"
              className="input-field w-full"
              placeholder="Jane"
            />
          </div>
          <div>
            <label htmlFor="add-last-name" className="mb-1 block text-sm font-medium text-theme">
              Last Name
            </label>
            <input
              id="add-last-name"
              type="text"
              value={formLast}
              onChange={(e) => setFormLast(e.target.value)}
              required
              autoComplete="family-name"
              className="input-field w-full"
              placeholder="Doe"
            />
          </div>
          <div>
            <label htmlFor="add-email" className="mb-1 block text-sm font-medium text-theme">
              Email
            </label>
            <input
              id="add-email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
              autoComplete="email"
              className="input-field w-full"
              placeholder="jane@company.com"
            />
          </div>
          <div>
            <label htmlFor="add-role" className="mb-1 block text-sm font-medium text-theme">
              Role
            </label>
            <select
              id="add-role"
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as CreatableCompanyRole)}
              className="input-field w-full"
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="HR">HR</option>
            </select>
            <p className="mt-1 text-xs text-theme-muted">
              Creates a Supabase login for this email. Share the temporary password securely.
            </p>
          </div>
          {branchScoped ? (
            <div className="surface-callout rounded-md px-3 py-2 text-sm text-theme">
              New employees are created in your branch
              {authUser?.branch?.name ? `: ${authUser.branch.name}` : ""}. Only company admins can assign other
              branches.
            </div>
          ) : (
            <div>
              <label htmlFor="add-branch" className="mb-1 block text-sm font-medium text-theme">
                Branch
              </label>
              <select
                id="add-branch"
                value={formBranchId}
                onChange={(e) => setFormBranchId(e.target.value)}
                className="input-field w-full"
              >
                {branches.length === 0 ? (
                  <option value="">Default (after load)</option>
                ) : (
                  branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.is_default ? " (default)" : ""}
                    </option>
                  ))
                )}
              </select>
              <p className="mt-1 text-xs text-theme-muted">
                Leave as default or pick a branch. Only company admins can change branch later.
              </p>
            </div>
          )}
          <div>
            <label htmlFor="add-password" className="mb-1 block text-sm font-medium text-theme">
              Temporary password
            </label>
            <input
              id="add-password"
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="input-field w-full"
              placeholder="At least 6 characters"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeAddModal}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {formSubmitting ? "Adding…" : "Add Employee"}
            </button>
          </div>
        </form>
      </Modal>

      {detailOpen ? (
        <>
          <button
            type="button"
            onClick={closeDetails}
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Close user detail panel"
          />
          <aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l p-5 shadow-2xl"
            style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  User profile
                </h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Company user details and access summary.
                </p>
              </div>
              <button type="button" onClick={closeDetails} className="text-sm" style={{ color: "var(--text-muted)" }}>
                Close
              </button>
            </div>

            {detailLoading ? (
              <LoadingState message="Loading user details…" className="mt-5 min-h-[140px]" />
            ) : detailError ? (
              <div className="alert-error mt-4 px-3 py-2">{detailError}</div>
            ) : selectedUser ? (
              <div className="mt-5 space-y-5">
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}>
                  <div className="flex items-center gap-3">
                    {selectedUser.profile_photo_url ? (
                      <img
                        src={selectedUser.profile_photo_url}
                        alt={`${selectedName} profile`}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-base font-semibold text-primary-700 dark:bg-primary-900/45 dark:text-primary-200">
                        {selectedName?.[0] ?? "U"}
                      </div>
                    )}
                    <div>
                      <div className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                        {selectedName || "—"}
                      </div>
                      <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                        {selectedRoleLabel}
                      </div>
                    </div>
                    <div className="ml-auto">{accountStatusBadge(selectedUser.status)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["Email", selectedUser.email],
                    ["Phone", selectedUser.phone_number ?? "—"],
                    ["Gender", selectedUser.gender ?? "—"],
                    [
                      "Date of birth",
                      selectedUser.date_of_birth
                        ? new Date(selectedUser.date_of_birth).toLocaleDateString()
                        : "—",
                    ],
                    ["Company", selectedUser.company_name ?? "—"],
                    ["Branch", selectedUser.branch?.name ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
                      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-medium break-all" style={{ color: "var(--text-primary)" }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Account status
                  </p>
                  {canChangeUserStatus ? (
                    <div className="mt-2 space-y-2">
                      <select
                        value={detailStatusDraft}
                        onChange={(e) =>
                          setDetailStatusDraft(e.target.value as UserListItem["status"])
                        }
                        disabled={statusSaving}
                        className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                        style={{
                          borderColor: "var(--border-soft)",
                          background: "var(--surface)",
                          color: "var(--text-primary)",
                        }}
                        aria-label={`Account status for ${selectedName}`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                      <button
                        type="button"
                        disabled={
                          statusSaving || detailStatusDraft === selectedUser.status
                        }
                        onClick={() => setStatusModalOpen(true)}
                        className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        Update status…
                      </button>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Inactive or suspended users cannot sign in. Managers cannot change status.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {selectedUser.status === "active"
                        ? "Active"
                        : selectedUser.status === "inactive"
                          ? "Inactive"
                          : "Suspended"}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
                  <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Department
                  </p>
                  {canAssignDepartment ? (
                    <div className="mt-2">
                      <select
                        value={selectedUser.department_id ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          void handleAssignDepartment(selectedUser.id, v === "" ? null : v);
                        }}
                        disabled={departmentAssigningId === selectedUser.id}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                        style={{
                          borderColor: "var(--border-soft)",
                          background: "var(--surface)",
                          color: "var(--text-primary)",
                        }}
                        aria-label={`Department for ${selectedName}`}
                      >
                        <option value="">No department</option>
                        {departmentsForSelectedBranch.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        Only departments in this employee&apos;s branch are listed.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {selectedUser.department?.name ?? "—"}
                    </p>
                  )}
                </div>

                {canRecordManualAttendance ? (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Attendance
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      Record a manual check-in or check-out when the employee could not use the app. Requires a reason;
                      audited with your account.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setManualAttUserId(selectedUser.id);
                        setManualAttOpen(true);
                      }}
                      className="mt-2 rounded-md border px-3 py-2 text-sm font-medium"
                      style={{
                        borderColor: "var(--border-soft)",
                        background: "var(--surface)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Manual check-in / check-out…
                    </button>
                  </div>
                ) : null}

                {canManageSalaryDayOverride && detailOpen && selectedUser ? (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Salary day override (admin / HR)
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      Override a specific calendar day’s salary credit (0.0 / 0.5 / 1.0). This does not auto clock-out
                      incomplete sessions.
                    </p>
                    <div className="mt-3">
                      {dayOverrideError ? (
                        <p className="mt-2 text-sm" style={{ color: "var(--state-error-text)" }}>
                          {dayOverrideError}
                        </p>
                      ) : null}
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-theme-muted">Date</label>
                          <input
                            type="date"
                            value={dayOverrideDate}
                            onChange={(e) => setDayOverrideDate(e.target.value)}
                            className="input-field mt-1 w-full py-1.5"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-theme-muted">Override</label>
                          <select
                            value={String(dayOverrideUnits)}
                            onChange={(e) => setDayOverrideUnits(Number(e.target.value) as dayClassApi.DayUnits)}
                            className="input-field mt-1 w-full py-1.5"
                          >
                            <option value="0">Not counted (0.0)</option>
                            <option value="0.5">Half day (0.5)</option>
                            <option value="1">Full day (1.0)</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-theme-muted">Note (optional)</label>
                          <input
                            type="text"
                            value={dayOverrideNote}
                            onChange={(e) => setDayOverrideNote(e.target.value)}
                            placeholder="e.g. sickness, approved early departure"
                            className="input-field mt-1 w-full py-1.5"
                          />
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-theme-muted">
                        {dayOverrideLoading ? (
                          <p>Loading day classification…</p>
                        ) : dayOverrideInfo ? (
                          <>
                            <p>
                              Completed minutes: <span className="font-medium">{dayOverrideInfo.worked_minutes_completed}</span>{" "}
                              · Incomplete session:{" "}
                              <span className="font-medium">
                                {dayOverrideInfo.has_incomplete_session ? "Yes" : "No"}
                              </span>
                            </p>
                            <p>
                              Auto units: <span className="font-medium">{dayOverrideInfo.automatic_day_units}</span>{" "}
                              · Override:{" "}
                              <span className="font-medium">
                                {dayOverrideInfo.override_day_units == null ? "—" : dayOverrideInfo.override_day_units}
                              </span>{" "}
                              · Final: <span className="font-medium">{dayOverrideInfo.final_day_units}</span>
                            </p>
                          </>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={dayOverrideLoading}
                          onClick={async () => {
                            if (!selectedUser) return;
                            setDayOverrideError(null);
                            try {
                              const res = await dayClassApi.upsertDayOverride({
                                user_id: selectedUser.id,
                                date: dayOverrideDate,
                                day_units: dayOverrideUnits,
                                note: dayOverrideNote.trim() || null,
                              });
                              if (isApiError(res)) {
                                setDayOverrideError(res.error ?? "Failed to save override");
                                toast.error(res.error ?? "Failed to save override");
                                return;
                              }
                              toast.success("Day override saved");
                              const refreshed = await dayClassApi.getDayClassification({
                                user_id: selectedUser.id,
                                date: dayOverrideDate,
                              });
                              if (!isApiError(refreshed)) setDayOverrideInfo(refreshed.data);
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : "Failed to save override";
                              setDayOverrideError(msg);
                              toast.error(msg);
                            }
                          }}
                          className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          Save override
                        </button>
                        <button
                          type="button"
                          disabled={dayOverrideLoading}
                          onClick={async () => {
                            if (!selectedUser) return;
                            setDayOverrideError(null);
                            try {
                              const res = await dayClassApi.deleteDayOverride({
                                user_id: selectedUser.id,
                                date: dayOverrideDate,
                              });
                              if (isApiError(res)) {
                                setDayOverrideError(res.error ?? "Failed to remove override");
                                toast.error(res.error ?? "Failed to remove override");
                                return;
                              }
                              toast.success("Override removed");
                              const refreshed = await dayClassApi.getDayClassification({
                                user_id: selectedUser.id,
                                date: dayOverrideDate,
                              });
                              if (!isApiError(refreshed)) setDayOverrideInfo(refreshed.data);
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : "Failed to remove override";
                              setDayOverrideError(msg);
                              toast.error(msg);
                            }
                          }}
                          className="rounded-md border px-3 py-2 text-sm font-medium"
                          style={{
                            borderColor: "var(--border-soft)",
                            background: "var(--surface)",
                            color: "var(--text-primary)",
                          }}
                        >
                          Remove override
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {canManageLeaveBalances ? (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Leave balance (admin / HR)
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      Leave requests require a balance allocation. Set total and used days for this employee.
                    </p>
                    {leaveBalanceError ? (
                      <p className="mt-2 text-sm" style={{ color: "var(--state-error-text)" }}>
                        {leaveBalanceError}
                      </p>
                    ) : null}
                    {leaveBalanceLoading ? (
                      <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                        Loading leave balance…
                      </p>
                    ) : (
                      <form
                        className="mt-3 grid gap-2 sm:grid-cols-2"
                        onSubmit={async (ev) => {
                          ev.preventDefault();
                          if (!selectedUser) return;
                          setLeaveSaving(true);
                          setLeaveBalanceError(null);
                          try {
                            const total = Number(leaveTotalDays);
                            const used = Number(leaveUsedDays || 0);
                            if (!Number.isFinite(total) || total < 0) {
                              setLeaveBalanceError("Total days must be a number >= 0");
                              return;
                            }
                            if (!Number.isFinite(used) || used < 0) {
                              setLeaveBalanceError("Used days must be a number >= 0");
                              return;
                            }
                            if (used > total) {
                              setLeaveBalanceError("Used days cannot exceed total days");
                              return;
                            }

                            const res = leaveBalance
                              ? await leaveBalancesApi.updateLeaveBalance(leaveBalance.id, {
                                  total_days: total,
                                  used_days: used,
                                })
                              : await leaveBalancesApi.createLeaveBalance({
                                  user_id: selectedUser.id,
                                  total_days: total,
                                  used_days: used,
                                });

                            if (isApiError(res)) {
                              setLeaveBalanceError(res.error ?? "Failed to save leave balance");
                              toast.error(res.error ?? "Failed to save leave balance");
                              return;
                            }
                            toast.success("Leave balance saved");
                            const refreshed = await leaveBalancesApi.getUserLeaveBalance(selectedUser.id);
                            if (!isApiError(refreshed)) {
                              setLeaveBalance(refreshed.data ?? null);
                            }
                          } catch (e) {
                            const msg = e instanceof Error ? e.message : "Failed to save leave balance";
                            setLeaveBalanceError(msg);
                            toast.error(msg);
                          } finally {
                            setLeaveSaving(false);
                          }
                        }}
                      >
                        <div>
                          <label className="text-xs font-medium text-theme-muted">Total days</label>
                          <input
                            type="number"
                            step="1"
                            min={0}
                            value={leaveTotalDays}
                            onChange={(e) => setLeaveTotalDays(e.target.value)}
                            className="input-field mt-1 w-full py-1.5"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-theme-muted">Used days</label>
                          <input
                            type="number"
                            step="1"
                            min={0}
                            value={leaveUsedDays}
                            onChange={(e) => setLeaveUsedDays(e.target.value)}
                            className="input-field mt-1 w-full py-1.5"
                          />
                        </div>
                        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Remaining:{" "}
                            {(() => {
                              const t = Number(leaveTotalDays);
                              const u = Number(leaveUsedDays || 0);
                              if (!Number.isFinite(t) || !Number.isFinite(u)) return "—";
                              return String(Math.max(0, t - u));
                            })()}
                          </p>
                          <button
                            type="submit"
                            disabled={leaveSaving}
                            className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {leaveBalance ? "Update balance" : "Create balance"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : null}

                {showCompensationPanel ? (
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)" }}>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Compensation (admin / HR)
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      Hourly or monthly salary. Monthly pay uses company working week and holidays to compute payable
                      days (not a flat 30-day divisor unless you choose fixed).
                    </p>
                    {wageError ? (
                      <p className="mt-2 text-sm" style={{ color: "var(--state-error-text)" }}>
                        {wageError}
                      </p>
                    ) : null}
                    {wageLoading ? (
                      <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                        Loading wage history…
                      </p>
                    ) : wageRows.length === 0 ? (
                      <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                        No wage rows yet.
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-40 space-y-2 overflow-auto text-sm">
                        {wageRows.map((w) => (
                          <li
                            key={w.id}
                            className="flex flex-wrap items-start justify-between gap-2 border-b pb-2 last:border-0"
                            style={{ borderColor: "var(--border-soft)", color: "var(--text-primary)" }}
                          >
                            <span>
                              <span className="font-medium">{w.effective_from}</span> — {w.rate_type}
                              {w.rate_type === "hourly" && w.hourly_rate != null
                                ? ` @ ${formatCurrency(w.hourly_rate, currencyCode)}/hr`
                                : w.monthly_salary != null
                                  ? ` ${formatCurrency(w.monthly_salary, currencyCode)}/mo (${w.salary_divisor_type})`
                                  : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => setWageDeleteTarget(w)}
                              disabled={wageDeleteSubmitting}
                              className="shrink-0 text-xs font-medium text-red-700 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form
                      className="mt-3 grid gap-2 sm:grid-cols-2"
                      onSubmit={async (ev) => {
                        ev.preventDefault();
                        if (!selectedUser) return;
                        setWageSaving(true);
                        setWageError(null);
                        try {
                          const body = {
                            user_id: selectedUser.id,
                            rate_type: wageRateType,
                            effective_from: wageEffectiveFrom,
                            ...(wageRateType === "hourly"
                              ? { hourly_rate: Number(wageHourly) }
                              : {
                                  monthly_salary: Number(wageMonthly),
                                  salary_divisor_type: wageDivisorType,
                                  salary_divisor_value: Number(wageDivisorValue) || 30,
                                }),
                          };
                          const res = await wageRatesApi.createWageRate(body);
                          if (isApiError(res)) {
                            setWageError(res.error);
                            toast.error(res.error);
                            return;
                          }
                          toast.success("Wage rate saved");
                          const list = await wageRatesApi.getUserWageRates(selectedUser.id);
                          if (!isApiError(list)) setWageRows(list.data ?? []);
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : "Failed to save";
                          setWageError(msg);
                          toast.error(msg);
                        } finally {
                          setWageSaving(false);
                        }
                      }}
                    >
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-theme-muted">Rate type</label>
                        <select
                          value={wageRateType}
                          onChange={(e) => setWageRateType(e.target.value as WageRateType)}
                          className="input-field mt-1 w-full py-1.5"
                        >
                          <option value="hourly">Hourly</option>
                          <option value="monthly">Monthly salary</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium text-theme-muted">Effective from</label>
                        <input
                          type="date"
                          value={wageEffectiveFrom}
                          onChange={(e) => setWageEffectiveFrom(e.target.value)}
                          className="input-field mt-1 w-full py-1.5"
                          required
                        />
                      </div>
                      {wageRateType === "hourly" ? (
                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-theme-muted">Hourly rate</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={wageHourly}
                            onChange={(e) => setWageHourly(e.target.value)}
                            className="input-field mt-1 w-full py-1.5"
                            required
                          />
                        </div>
                      ) : (
                        <>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-theme-muted">Monthly salary</label>
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={wageMonthly}
                              onChange={(e) => setWageMonthly(e.target.value)}
                              className="input-field mt-1 w-full py-1.5"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-theme-muted">Divisor</label>
                            <select
                              value={wageDivisorType}
                              onChange={(e) =>
                                setWageDivisorType(e.target.value as "dynamic_working_days" | "fixed_days")
                              }
                              className="input-field mt-1 w-full py-1.5"
                            >
                              <option value="dynamic_working_days">Dynamic (working + paid holidays)</option>
                              <option value="fixed_days">Fixed day count</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-theme-muted">
                              {wageDivisorType === "fixed_days" ? "Days" : "Fallback (unused for dynamic)"}
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={wageDivisorValue}
                              onChange={(e) => setWageDivisorValue(e.target.value)}
                              className="input-field mt-1 w-full py-1.5"
                            />
                          </div>
                        </>
                      )}
                      <div className="sm:col-span-2">
                        <button
                          type="submit"
                          disabled={wageSaving}
                          className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                        >
                          {wageSaving ? "Saving…" : "Add wage row"}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}

                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: "var(--state-error-border)",
                    background: "var(--state-error-bg)",
                  }}
                >
                  <h3 className="text-sm font-semibold" style={{ color: "var(--state-error-text)" }}>
                    Danger zone
                  </h3>
                  {selectedCanBeDeleted ? (
                    <>
                      <p className="mt-1 text-xs" style={{ color: "var(--state-error-text)" }}>
                        To delete this user, type their full name exactly:
                        {" "}
                        <strong>{selectedName}</strong>
                      </p>
                      <input
                        value={deleteConfirmValue}
                        onChange={(e) => setDeleteConfirmValue(e.target.value)}
                        className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
                        style={{
                          borderColor: "var(--border-soft)",
                          background: "var(--surface)",
                          color: "var(--text-primary)",
                        }}
                        placeholder="Type full name to confirm"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDeleteUserFromDetails()}
                        disabled={deleteSubmitting || deleteConfirmValue.trim() !== selectedName || selectedUserId == null}
                        className="mt-3 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {deleteSubmitting ? "Deleting…" : "Delete user"}
                      </button>
                    </>
                  ) : (
                    <p className="mt-1 text-xs" style={{ color: "var(--state-error-text)" }}>
                      Only company admins can delete employee/HR/manager users. Admin users and your own account cannot be deleted.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </aside>
        </>
      ) : null}

      <Modal
        open={wageDeleteTarget !== null}
        onClose={() => !wageDeleteSubmitting && setWageDeleteTarget(null)}
        title="Remove wage row?"
      >
        {wageDeleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-theme">
              This removes the compensation row effective{" "}
              <strong>{wageDeleteTarget.effective_from}</strong> ({wageDeleteTarget.rate_type}
              {wageDeleteTarget.rate_type === "hourly" && wageDeleteTarget.hourly_rate != null
                ? `, ${formatCurrency(wageDeleteTarget.hourly_rate, currencyCode)}/hr`
                : wageDeleteTarget.monthly_salary != null
                  ? `, ${formatCurrency(wageDeleteTarget.monthly_salary, currencyCode)}/mo`
                  : ""}
              ). Payroll and live earnings will use the next older row for that employee, if any; otherwise they
              will have no rate until a new row is added.
            </p>
            <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
              <button
                type="button"
                onClick={() => setWageDeleteTarget(null)}
                disabled={wageDeleteSubmitting}
                className="btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedUser || !wageDeleteTarget) return;
                  setWageDeleteSubmitting(true);
                  try {
                    const res = await wageRatesApi.deleteWageRate(wageDeleteTarget.id);
                    if (isApiError(res)) {
                      toast.error(res.error ?? "Failed to remove wage row");
                      return;
                    }
                    toast.success("Wage row removed");
                    setWageDeleteTarget(null);
                    const list = await wageRatesApi.getUserWageRates(selectedUser.id);
                    if (!isApiError(list)) setWageRows(list.data ?? []);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed to remove wage row");
                  } finally {
                    setWageDeleteSubmitting(false);
                  }
                }}
                disabled={wageDeleteSubmitting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {wageDeleteSubmitting ? "Removing…" : "Remove row"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={statusModalOpen}
        onClose={() => !statusSaving && setStatusModalOpen(false)}
        title="Confirm status change"
      >
        {selectedUser ? (
          <div className="space-y-4">
            <p className="text-sm text-theme">
              Change account status for <strong>{selectedName}</strong> from{" "}
              <strong>{selectedUser.status}</strong> to <strong>{detailStatusDraft}</strong>? They will{" "}
              {detailStatusDraft === "active" ? "be able to sign in again." : "not be able to sign in until reactivated."}
            </p>
            <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                disabled={statusSaving}
                className="btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusSaving}
                onClick={async () => {
                  if (!selectedUser) return;
                  setStatusSaving(true);
                  try {
                    const res = await usersApi.updateUser(selectedUser.id, {
                      status: detailStatusDraft,
                    });
                    if (isApiError(res)) {
                      toast.error(res.error ?? "Failed to update status");
                      return;
                    }
                    toast.success("Status updated");
                    setSelectedUser(res.data);
                    setDetailStatusDraft(res.data.status);
                    setStatusModalOpen(false);
                    await load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed to update status");
                  } finally {
                    setStatusSaving(false);
                  }
                }}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {statusSaving ? "Saving…" : "Confirm change"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ManualAttendanceModal
        open={manualAttOpen}
        onClose={() => {
          setManualAttOpen(false);
          setManualAttUserId(null);
        }}
        employees={users}
        initialUserId={manualAttUserId}
        onSuccess={() => void load()}
      />
    </MainContent>
  );
}
