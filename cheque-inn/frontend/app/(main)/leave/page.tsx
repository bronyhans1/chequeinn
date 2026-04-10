"use client";

import { useEffect, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { useAuth } from "@/lib/auth/AuthContext";
import { canAccessManagerFeatures, isBranchScopedCompanyUser } from "@/lib/auth/roles";
import * as leaveApi from "@/lib/api/leave.api";
import { isApiError } from "@/lib/types/api";
import type { LeaveRequest } from "@/lib/api/leave.api";

function statusBadge(status: string) {
  const s = status?.toLowerCase() ?? "";
  if (s === "approved") return <Badge variant="success">Approved</Badge>;
  if (s === "rejected") return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export default function LeavePage() {
  const { user } = useAuth();
  const toast = useToast();
  const isManager = canAccessManagerFeatures(user?.roles);
  const branchScoped = isBranchScopedCompanyUser(user?.roles);

  const [myLeave, setMyLeave] = useState<LeaveRequest[]>([]);
  const [companyLeave, setCompanyLeave] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formType, setFormType] = useState("annual");
  const [formReason, setFormReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    leave: LeaveRequest;
    action: "approve" | "reject";
  } | null>(null);
  const [companyStatusFilter, setCompanyStatusFilter] = useState<
    "" | "pending" | "approved" | "rejected"
  >("");

  async function loadMyLeave() {
    setMyError(null);
    try {
      const res = await leaveApi.getMyLeaveRequests();
      if (isApiError(res)) {
        setMyError(res.error);
        setMyLeave([]);
        return;
      }
      setMyLeave(res.data ?? []);
    } catch (e) {
      setMyError(e instanceof Error ? e.message : "Failed to load leave");
      setMyLeave([]);
    }
  }

  async function loadCompanyLeave() {
    if (!isManager) return;
    setCompanyError(null);
    try {
      const res = await leaveApi.getCompanyLeaveRequests(companyStatusFilter);
      if (isApiError(res)) {
        setCompanyError(res.error);
        setCompanyLeave([]);
        return;
      }
      setCompanyLeave(res.data ?? []);
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : "Failed to load company leave");
      setCompanyLeave([]);
    }
  }

  async function load() {
    setLoading(true);
    await Promise.all([loadMyLeave(), loadCompanyLeave()]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [isManager, companyStatusFilter]);

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const start = formStart.trim();
    const end = formEnd.trim();
    const leaveType = formType.trim();
    if (!start || !end || !leaveType) {
      setFormError("Start date, end date, and leave type are required.");
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await leaveApi.requestLeave({
        start_date: start,
        end_date: end,
        leave_type: leaveType,
        reason: formReason.trim() || undefined,
      });
      if (isApiError(res)) {
        setFormError(res.error ?? "Failed to submit leave request");
        return;
      }
      setRequestModalOpen(false);
      setFormStart("");
      setFormEnd("");
      setFormReason("");
      await loadMyLeave();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function confirmLeaveReview() {
    if (!reviewModal) return;
    const { leave, action } = reviewModal;
    setActionLoading(leave.id);
    try {
      const res = await leaveApi.reviewLeave(leave.id, action === "approve" ? "approve" : "reject");
      if (isApiError(res)) {
        toast.error(res.error ?? (action === "approve" ? "Failed to approve" : "Failed to reject"));
        return;
      }
      toast.success(action === "approve" ? "Leave approved" : "Leave rejected");
      setReviewModal(null);
      await loadCompanyLeave();
      await loadMyLeave();
    } finally {
      setActionLoading(null);
    }
  }

  const myColumns = [
    { key: "start_date", header: "Start", render: (r: LeaveRequest) => r.start_date },
    { key: "end_date", header: "End", render: (r: LeaveRequest) => r.end_date },
    { key: "total_days", header: "Days" },
    { key: "leave_type", header: "Type" },
    { key: "reason", header: "Reason", render: (r: LeaveRequest) => r.reason ?? "—" },
    { key: "status", header: "Status", render: (r: LeaveRequest) => statusBadge(r.status) },
  ];

  function truncateId(userId: string): string {
    return userId.slice(0, 8) + "…";
  }

  const companyColumns = [
    {
      key: "user_id",
      header: "User",
      render: (r: LeaveRequest) => {
        const displayBase = r.employee_name ?? r.employee_email ?? truncateId(r.user_id);
        return (
          <span
            className="text-theme-muted"
            title={r.employee_email ?? r.employee_name ?? r.user_id}
          >
            {displayBase}
            {r.employee_name && r.employee_email ? (
              <span className="ml-2 opacity-70">({r.employee_email})</span>
            ) : null}
          </span>
        );
      },
    },
    { key: "start_date", header: "Start", render: (r: LeaveRequest) => r.start_date },
    { key: "end_date", header: "End", render: (r: LeaveRequest) => r.end_date },
    { key: "total_days", header: "Days" },
    { key: "leave_type", header: "Type" },
    { key: "reason", header: "Reason", render: (r: LeaveRequest) => r.reason ?? "—" },
    { key: "status", header: "Status", render: (r: LeaveRequest) => statusBadge(r.status) },
    {
      key: "actions",
      header: "Actions",
      render: (r: LeaveRequest) =>
        r.status?.toLowerCase() === "pending" ? (
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => setReviewModal({ leave: r, action: "approve" })}
              disabled={actionLoading !== null}
              className="text-sm font-medium text-green-700 hover:text-green-800 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
            >
              {actionLoading === r.id ? "…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setReviewModal({ leave: r, action: "reject" })}
              disabled={actionLoading !== null}
              className="text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
            >
              Reject
            </button>
          </span>
        ) : (
          "—"
        ),
    },
  ];

  if (loading && myLeave.length === 0 && companyLeave.length === 0) {
    return (
      <MainContent title="Leave">
        <LoadingState message="Loading leave…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  return (
    <MainContent title="Leave">
      {/* My leave — all users */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-theme">My leave requests</h2>
        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setRequestModalOpen(true);
          }}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Request Leave
        </button>
      </div>
      <Card className="mt-2">
        {myError ? (
          <ErrorState message={myError} onRetry={loadMyLeave} />
        ) : myLeave.length === 0 ? (
          <EmptyState message="You have no leave requests yet. Use Request Leave to create one." />
        ) : (
          <DataTable
            columns={myColumns}
            data={myLeave}
            keyExtractor={(r) => r.id}
            emptyMessage="No leave requests"
          />
        )}
      </Card>

      {/* Company leave — HR / admin / manager */}
      {isManager && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-theme">
                {branchScoped ? "Branch leave (review)" : "Company leave (review)"}
              </h2>
              {branchScoped ? (
                <p className="mt-1 text-xs text-theme-muted">
                  Showing requests from employees in your branch only.
                </p>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-theme">
              <span>Status</span>
              <select
                value={companyStatusFilter}
                onChange={(e) =>
                  setCompanyStatusFilter(
                    e.target.value as "" | "pending" | "approved" | "rejected"
                  )
                }
                className="input-field rounded-md py-1.5"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
          </div>
          <Card className="mt-2">
            {companyError ? (
              <ErrorState message={companyError} onRetry={loadCompanyLeave} />
            ) : companyLeave.length === 0 ? (
              <EmptyState
                message={
                  branchScoped
                    ? "No leave requests from your branch in this filter."
                    : "No company leave requests."
                }
              />
            ) : (
              <DataTable
                columns={companyColumns}
                data={companyLeave}
                keyExtractor={(r) => r.id}
                emptyMessage="No leave requests"
              />
            )}
          </Card>
        </>
      )}

      <Modal
        open={reviewModal !== null}
        onClose={() => actionLoading === null && setReviewModal(null)}
        title={reviewModal?.action === "approve" ? "Approve leave request?" : "Reject leave request?"}
      >
        {reviewModal ? (
          <div className="space-y-4">
            <div className="surface-callout rounded-md px-3 py-2 text-sm text-theme">
              <p>
                <span className="font-medium">Employee:</span>{" "}
                {reviewModal.leave.employee_name ??
                  reviewModal.leave.employee_email ??
                  reviewModal.leave.user_id.slice(0, 8) + "…"}
              </p>
              <p className="mt-1">
                <span className="font-medium">Dates:</span> {reviewModal.leave.start_date} →{" "}
                {reviewModal.leave.end_date} ({reviewModal.leave.total_days} day
                {reviewModal.leave.total_days === 1 ? "" : "s"})
              </p>
              <p className="mt-1">
                <span className="font-medium">Type:</span> {reviewModal.leave.leave_type}
              </p>
              {reviewModal.leave.reason ? (
                <p className="mt-1 text-theme-muted">
                  <span className="font-medium text-theme">Reason:</span> {reviewModal.leave.reason}
                </p>
              ) : null}
            </div>
            <p className="text-sm text-theme-muted">
              {reviewModal.action === "approve"
                ? "This will approve the request and consume leave balance when applicable."
                : "This will reject the request. The employee will see the rejected status."}
            </p>
            <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                disabled={actionLoading !== null}
                className="btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmLeaveReview()}
                disabled={actionLoading !== null}
                className={
                  reviewModal.action === "approve"
                    ? "rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    : "rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                }
              >
                {actionLoading !== null
                  ? "Working…"
                  : reviewModal.action === "approve"
                    ? "Approve"
                    : "Reject"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} title="Request Leave">
        <form onSubmit={handleRequestSubmit} className="space-y-4">
          {formError && (
            <div className="alert-error px-3 py-2">{formError}</div>
          )}
          <div>
            <label htmlFor="leave-start" className="mb-1 block text-sm font-medium text-theme">
              Start date
            </label>
            <input
              id="leave-start"
              type="date"
              value={formStart}
              onChange={(e) => setFormStart(e.target.value)}
              required
              className="input-field w-full"
            />
          </div>
          <div>
            <label htmlFor="leave-end" className="mb-1 block text-sm font-medium text-theme">
              End date
            </label>
            <input
              id="leave-end"
              type="date"
              value={formEnd}
              onChange={(e) => setFormEnd(e.target.value)}
              required
              className="input-field w-full"
            />
          </div>
          <div>
            <label htmlFor="leave-type" className="mb-1 block text-sm font-medium text-theme">
              Leave type
            </label>
            <select
              id="leave-type"
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="input-field w-full"
            >
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="unpaid">Unpaid</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="leave-reason" className="mb-1 block text-sm font-medium text-theme">
              Reason (optional)
            </label>
            <textarea
              id="leave-reason"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              rows={2}
              className="input-field w-full"
              placeholder="Optional note"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRequestModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {formSubmitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      </Modal>
    </MainContent>
  );
}
