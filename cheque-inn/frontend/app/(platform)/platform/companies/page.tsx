"use client";

import { useEffect, useMemo, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/lib/auth/AuthContext";
import { isPlatformAdmin } from "@/lib/auth/roles";
import * as platformApi from "@/lib/api/platform.api";
import { isApiError } from "@/lib/types/api";
import type { PlatformCompanyListItem, ProvisionCompanyData } from "@/lib/api/platform.api";
import { useToast } from "@/components/ui/ToastProvider";
import { Modal } from "@/components/ui/Modal";

export default function PlatformProvisionCompanyPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canProvision = isPlatformAdmin(user?.roles);

  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [branchLimit, setBranchLimit] = useState<string>("");

  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionCompanyData | null>(null);

  const [companies, setCompanies] = useState<PlatformCompanyListItem[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformCompanyListItem | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<PlatformCompanyListItem | null>(null);
  const [detailBranchLimit, setDetailBranchLimit] = useState<string>("");
  const [detailBranchLimitSaving, setDetailBranchLimitSaving] = useState(false);
  const [detailCompanyStatus, setDetailCompanyStatus] = useState<PlatformCompanyListItem["status"]>("active");
  const [companyStatusModalOpen, setCompanyStatusModalOpen] = useState(false);
  const [companyStatusSaving, setCompanyStatusSaving] = useState(false);

  function branchUsageLabel(company: PlatformCompanyListItem): string {
    const limit = company.branch_limit;
    return `${company.branches_count} / ${limit === null ? "Unlimited" : limit}`;
  }

  async function loadCompanies() {
    setCompaniesError(null);
    setCompaniesLoading(true);
    try {
      const res = await platformApi.getCompanies();
      if (isApiError(res)) {
        setCompaniesError(res.error ?? "Failed to load companies");
        setCompanies([]);
        return;
      }
      setCompanies(res.data ?? []);
    } catch (e) {
      setCompaniesError(e instanceof Error ? e.message : "Failed to load companies");
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  }

  useEffect(() => {
    if (!canProvision) return;
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canProvision]);

  const canSubmit = useMemo(() => {
    return (
      !!companyName.trim() &&
      !!adminFirstName.trim() &&
      !!adminLastName.trim() &&
      !!adminEmail.trim() &&
      temporaryPassword.length >= 6
    );
  }, [companyName, adminFirstName, adminLastName, adminEmail, temporaryPassword]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!canProvision) {
      setError("Forbidden: PLATFORM_ADMIN only.");
      return;
    }
    if (!canSubmit) {
      setError(
        "Please fill all required fields (and ensure temporary password is at least 6 characters)."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await platformApi.provisionCompany({
        company_name: companyName.trim(),
        company_code: companyCode.trim() ? companyCode.trim() : null,
        admin_first_name: adminFirstName.trim(),
        admin_last_name: adminLastName.trim(),
        admin_email: adminEmail.trim(),
        temporary_password: temporaryPassword,
        branch_limit: branchLimit.trim() ? Number(branchLimit.trim()) : null,
      });

      if (isApiError(res)) {
        setError(res.error ?? "Failed to provision company");
        toast.error(res.error ?? "Failed to provision company");
        return;
      }

      setResult(res.data ?? null);
      toast.success("Company created successfully");
      await loadCompanies();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to provision company";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCompany() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setError(null);
    try {
      const targetCompanyId = deleteTarget.company_id;
      const res = await platformApi.deleteCompany(targetCompanyId, deleteConfirmName);
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to delete company";
        setError(msg);
        toast.error(msg);
        return;
      }

      // Immediately reflect success in UI, then refresh from server.
      setCompanies((prev) => prev.filter((c) => c.company_id !== targetCompanyId));
      if (detailTarget?.company_id === targetCompanyId) {
        setDetailTarget(null);
      }
      setDeleteTarget(null);
      setDeleteConfirmName("");
      toast.success("Company deleted successfully");
      await loadCompanies();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete company";
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  if (!canProvision) {
    return (
      <MainContent title="Platform - Provision Company">
        <ErrorState message="Forbidden: PLATFORM_ADMIN only." />
      </MainContent>
    );
  }

  if (submitting && !result) {
    return (
      <MainContent title="Platform - Provision Company">
        <LoadingState message="Provisioning company…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  return (
    <MainContent title="Platform - Provision Company">
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Company details">
          {error && (
            <div className="alert-error mb-4 px-3 py-2">{error}</div>
          )}

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="company_name"
                  className="mb-1 block text-sm font-medium text-theme"
                >
                  Company name
                </label>
                <input
                  id="company_name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="input-field w-full"
                  placeholder="e.g. Cheque Inn Ltd"
                />
              </div>

              <div>
                <label
                  htmlFor="company_code"
                  className="mb-1 block text-sm font-medium text-theme"
                >
                  Company code (optional)
                </label>
                <input
                  id="company_code"
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value)}
                  className="input-field w-full"
                  placeholder="e.g. cqin-001"
                />
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Leave blank to auto-generate a company code.
                </p>
              </div>

              <div>
                <label
                  htmlFor="branch_limit"
                  className="mb-1 block text-sm font-medium text-theme"
                >
                  Branch limit (optional)
                </label>
                <input
                  id="branch_limit"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={branchLimit}
                  onChange={(e) => setBranchLimit(e.target.value)}
                  className="input-field w-full"
                  placeholder="Leave blank for unlimited"
                />
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  This is a platform-controlled limit. Use blank for unlimited.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="admin_first_name"
                    className="mb-1 block text-sm font-medium text-theme"
                  >
                    Admin first name
                  </label>
                  <input
                    id="admin_first_name"
                    type="text"
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    required
                    className="input-field w-full"
                    placeholder="Brony"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin_last_name"
                    className="mb-1 block text-sm font-medium text-theme"
                  >
                    Admin last name
                  </label>
                  <input
                    id="admin_last_name"
                    type="text"
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    required
                    className="input-field w-full"
                    placeholder="Hans"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin_email"
                  className="mb-1 block text-sm font-medium text-theme"
                >
                  Admin email
                </label>
                <input
                  id="admin_email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  className="input-field w-full"
                  placeholder="admin@company.com"
                />
              </div>

              <div>
                <label
                  htmlFor="temporary_password"
                  className="mb-1 block text-sm font-medium text-theme"
                >
                  Temporary password
                </label>
                <input
                  id="temporary_password"
                  type="password"
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  required
                  className="input-field w-full"
                  placeholder="At least 6 characters"
                />
                <p className="mt-0.5 text-xs text-theme-muted">
                  Used to create the initial auth account.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? "Provisioning…" : "Provision company"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-theme">
                Provisioned successfully.
              </p>
              <div className="surface-callout rounded-md p-3 text-sm">
                <div className="font-medium text-theme">{result.company_name}</div>
                <div className="mt-1 text-theme-muted">
                  Company code:{" "}
                  <span className="font-mono">{result.company_code}</span>
                </div>
                <div className="mt-1 text-theme-muted">
                  Admin email:{" "}
                  <span className="font-mono">{result.admin_email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setError(null);
                  setCompanyName("");
                  setCompanyCode("");
                  setBranchLimit("");
                  setAdminFirstName("");
                  setAdminLastName("");
                  setAdminEmail("");
                  setTemporaryPassword("");
                }}
                className="btn-secondary"
              >
                Provision another
              </button>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Existing companies">
            {companiesError ? (
              <div className="alert-error px-3 py-2">
                {companiesError}
              </div>
            ) : null}

            {companiesLoading ? (
              <LoadingState message="Loading companies…" className="min-h-[120px]" />
            ) : companies.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>No companies yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}>
                      <th className="py-2 pr-4 font-medium">Name</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Branches</th>
                      <th className="py-2 pr-4 font-medium">Admin email(s)</th>
                      <th className="py-2 pr-4 font-medium">Created</th>
                      <th className="py-2 pl-3 pr-0 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.company_id} className="border-b" style={{ borderColor: "var(--border-soft)" }}>
                        <td className="py-2 pr-4" style={{ color: "var(--text-primary)" }}>{c.company_name}</td>
                        <td className="py-2 pr-4 text-xs font-semibold capitalize" style={{ color: "var(--text-muted)" }}>
                          {c.status}
                        </td>
                        <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>
                          {branchUsageLabel(c)}
                        </td>
                        <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>
                          {c.admin_emails?.length ? c.admin_emails.join(", ") : "—"}
                        </td>
                        <td className="py-2 pr-4" style={{ color: "var(--text-muted)" }}>
                          {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}
                        </td>
                        <td className="py-2 pl-3 pr-0">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDetailTarget(c);
                                setDetailBranchLimit(c.branch_limit === null ? "" : String(c.branch_limit));
                                setDetailCompanyStatus(c.status);
                              }}
                              className="rounded border px-2.5 py-1 text-xs font-semibold"
                              style={{ borderColor: "var(--border-soft)", color: "var(--text-primary)" }}
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(c);
                                setDeleteConfirmName("");
                              }}
                              className="rounded border border-red-400 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-500/10 dark:border-red-500/50 dark:text-red-300 dark:hover:bg-red-500/15"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3">
              <button
                type="button"
                onClick={loadCompanies}
                disabled={companiesLoading}
                className="btn-secondary btn-secondary-sm disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </Card>

          <Card title="Next steps (platform -> company admin)">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              After provisioning, share the admin email and temporary password with the company admin.
              The company admin can then create HR, managers, employees, departments, and shifts.
            </p>
          </Card>

          <Card title="Danger zone">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Company deletion is permanent and removes company data from the application database.
            </p>
          </Card>
        </div>
      </div>

      {deleteTarget ? (
        <>
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Close delete company dialog"
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 shadow-2xl"
               style={{ background: "var(--surface)", borderColor: "var(--border-soft)" }}>
            <h3 className="text-lg font-semibold text-red-700">Delete company</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Type <strong>{deleteTarget.company_name}</strong> to confirm permanent deletion.
            </p>
            <input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              className="mt-3 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)", color: "var(--text-primary)" }}
              placeholder="Company name"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border-soft)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCompany}
                disabled={deleteSubmitting || deleteConfirmName.trim() !== deleteTarget.company_name}
                className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {deleteSubmitting ? "Deleting…" : "Delete company"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {detailTarget ? (
        <>
          <button
            type="button"
            onClick={() => setDetailTarget(null)}
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Close company details dialog"
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 shadow-2xl"
            style={{ background: "var(--surface)", borderColor: "var(--border-soft)" }}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Company details
              </h3>
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded border p-3" style={{ borderColor: "var(--border-soft)" }}>
                <p className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>Name</p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{detailTarget.company_name}</p>
              </div>
              <div className="rounded border p-3" style={{ borderColor: "var(--border-soft)" }}>
                <p className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>Admin email(s)</p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  {detailTarget.admin_emails?.length ? detailTarget.admin_emails.join(", ") : "—"}
                </p>
              </div>
              <div className="rounded border p-3 sm:col-span-2" style={{ borderColor: "var(--border-soft)" }}>
                <p className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>Created</p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  {detailTarget.created_at ? new Date(detailTarget.created_at).toLocaleString() : "—"}
                </p>
              </div>
            </div>

            <div
              className="mt-4 rounded border p-3 sm:col-span-2"
              style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}
            >
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Account status
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Current:{" "}
                <span className="font-semibold capitalize text-theme">{detailTarget.status}</span>. Inactive or
                suspended companies block every user in that company from signing in.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[200px]">
                  <label htmlFor="detail-company-status" className="mb-1 block text-sm font-medium text-theme">
                    Set status
                  </label>
                  <select
                    id="detail-company-status"
                    value={detailCompanyStatus}
                    onChange={(e) =>
                      setDetailCompanyStatus(e.target.value as PlatformCompanyListItem["status"])
                    }
                    disabled={companyStatusSaving}
                    className="w-full rounded border px-3 py-2 text-sm disabled:opacity-50"
                    style={{
                      borderColor: "var(--border-soft)",
                      background: "var(--surface)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={
                    companyStatusSaving || detailCompanyStatus === detailTarget.status
                  }
                  onClick={() => setCompanyStatusModalOpen(true)}
                  className="rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Update status…
                </button>
              </div>
            </div>

            <div className="mt-4 rounded border p-3" style={{ borderColor: "var(--border-soft)" }}>
              <p className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
                Branch creation limit
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Current usage: <span className="font-medium">{branchUsageLabel(detailTarget)}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[220px]">
                  <label
                    htmlFor="detail-branch-limit"
                    className="mb-1 block text-sm font-medium text-theme"
                  >
                    Limit (blank = unlimited)
                  </label>
                  <input
                    id="detail-branch-limit"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={detailBranchLimit}
                    onChange={(e) => setDetailBranchLimit(e.target.value)}
                    className="w-full rounded border px-3 py-2 text-sm"
                    style={{
                      borderColor: "var(--border-soft)",
                      background: "var(--surface-muted)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="Unlimited"
                  />
                </div>
                <button
                  type="button"
                  disabled={detailBranchLimitSaving}
                  onClick={async () => {
                    setDetailBranchLimitSaving(true);
                    setError(null);
                    try {
                      const parsed =
                        detailBranchLimit.trim() === "" ? null : Number(detailBranchLimit.trim());
                      if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
                        toast.error("Branch limit must be a whole number (>= 0), or blank for unlimited.");
                        return;
                      }
                      const res = await platformApi.patchCompany(detailTarget.company_id, {
                        branch_limit: parsed,
                      });
                      if (isApiError(res)) {
                        const msg = res.error ?? "Failed to update branch limit";
                        setError(msg);
                        toast.error(msg);
                        return;
                      }
                      toast.success("Branch limit updated");
                      setDetailTarget((prev) => (prev ? { ...prev, branch_limit: parsed } : prev));
                      await loadCompanies();
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Failed to update branch limit";
                      setError(msg);
                      toast.error(msg);
                    } finally {
                      setDetailBranchLimitSaving(false);
                    }
                  }}
                  className="rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {detailBranchLimitSaving ? "Saving…" : "Save limit"}
                </button>
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                Lowering the limit never deletes branches; it only blocks creating new ones.
              </p>
            </div>

            <div className="mt-4 rounded border p-3" style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}>
              <p className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>Technical identifiers</p>
              <p className="mt-1 text-sm font-mono break-all" style={{ color: "var(--text-primary)" }}>
                Code: {detailTarget.company_code}
              </p>
              <p className="mt-1 text-xs font-mono break-all" style={{ color: "var(--text-muted)" }}>
                ID: {detailTarget.company_id}
              </p>
            </div>
          </div>
        </>
      ) : null}

      <Modal
        open={companyStatusModalOpen}
        onClose={() => !companyStatusSaving && setCompanyStatusModalOpen(false)}
        title="Confirm company status"
      >
        {detailTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-theme">
              Change <strong>{detailTarget.company_name}</strong> from{" "}
              <strong>{detailTarget.status}</strong> to <strong>{detailCompanyStatus}</strong>? All users in this
              company will be blocked from signing in unless the company is active.
            </p>
            <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
              <button
                type="button"
                onClick={() => setCompanyStatusModalOpen(false)}
                disabled={companyStatusSaving}
                className="btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={companyStatusSaving}
                onClick={async () => {
                  if (!detailTarget) return;
                  setCompanyStatusSaving(true);
                  setError(null);
                  try {
                    const res = await platformApi.patchCompany(detailTarget.company_id, {
                      status: detailCompanyStatus,
                    });
                    if (isApiError(res)) {
                      const msg = res.error ?? "Failed to update status";
                      setError(msg);
                      toast.error(msg);
                      return;
                    }
                    toast.success("Company status updated");
                    setDetailTarget((prev) =>
                      prev ? { ...prev, status: detailCompanyStatus } : prev
                    );
                    setCompanyStatusModalOpen(false);
                    await loadCompanies();
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : "Failed to update status";
                    setError(msg);
                    toast.error(msg);
                  } finally {
                    setCompanyStatusSaving(false);
                  }
                }}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {companyStatusSaving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </MainContent>
  );
}

