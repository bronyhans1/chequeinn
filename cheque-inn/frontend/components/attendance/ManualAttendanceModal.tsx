"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import * as attendanceApi from "@/lib/api/attendance.api";
import { ApiClientError } from "@/lib/api/client";
import { isApiError } from "@/lib/types/api";
import type { UserListItem } from "@/lib/api/users.api";
import { MANUAL_ATTENDANCE_REASONS } from "@/lib/attendance/manualAttendance";
import { useToast } from "@/components/ui/ToastProvider";

type Action = "check_in" | "check_out";

export interface ManualAttendanceModalProps {
  open: boolean;
  onClose: () => void;
  employees: UserListItem[];
  /** When set, pre-selects this employee when the modal opens. */
  initialUserId?: string | null;
  onSuccess?: () => void;
}

function fullName(u: UserListItem): string {
  const first = u.first_name?.trim() ?? "";
  const last = u.last_name?.trim() ?? "";
  return [first, last].filter(Boolean).join(" ") || (u.email ?? "—");
}

export function ManualAttendanceModal({
  open,
  onClose,
  employees,
  initialUserId,
  onSuccess,
}: ManualAttendanceModalProps) {
  const toast = useToast();
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState<Action>("check_in");
  const [reason, setReason] = useState(MANUAL_ATTENDANCE_REASONS[0]?.code ?? "missed_scan");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUserId(initialUserId?.trim() ? initialUserId.trim() : "");
    setAction("check_in");
    setReason(MANUAL_ATTENDANCE_REASONS[0]?.code ?? "missed_scan");
    setNote("");
  }, [open, initialUserId]);

  const sorted = useMemo(() => {
    return [...employees].sort((a, b) => fullName(a).localeCompare(fullName(b), undefined, { sensitivity: "base" }));
  }, [employees]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      toast.error("Select an employee");
      return;
    }
    if (reason === "other" && !note.trim()) {
      toast.error("Add a note when the reason is Other");
      return;
    }
    setSubmitting(true);
    try {
      const notePayload = note.trim() ? note.trim() : null;
      const selected = employees.find((x) => x.id === userId);
      if (action === "check_in") {
        const res = await attendanceApi.manualClockIn({
          user_id: userId,
          department_id: selected?.department_id ?? undefined,
          reason,
          note: notePayload,
        });
        if (isApiError(res)) {
          toast.error(res.error ?? "Manual check-in failed");
          return;
        }
        toast.success("Manual check-in recorded");
      } else {
        const res = await attendanceApi.manualClockOut({
          user_id: userId,
          reason,
          note: notePayload,
        });
        if (isApiError(res)) {
          toast.error(res.error ?? "Manual check-out failed");
          return;
        }
        toast.success("Manual check-out recorded");
      }
      onSuccess?.();
      onClose();
    } catch (e) {
      const msg =
        e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Request failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Manual check-in / check-out">
      <form onSubmit={submit} className="space-y-4 p-4">
        <p className="text-sm text-theme-muted">
          Use when an employee could not use the app (e.g. device off, network issue, missed scan). All manual actions
          are audited with your account, reason, and optional note.
        </p>
        <div>
          <label htmlFor="manual-emp" className="mb-1 block text-xs font-medium text-theme">
            Employee
          </label>
          <select
            id="manual-emp"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
            className="input-field w-full"
          >
            <option value="">Select…</option>
            {sorted.map((u) => (
              <option key={u.id} value={u.id}>
                {fullName(u)} — {u.email}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-theme">Action</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="manual-action"
                checked={action === "check_in"}
                onChange={() => setAction("check_in")}
              />
              Manual check-in
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="manual-action"
                checked={action === "check_out"}
                onChange={() => setAction("check_out")}
              />
              Manual check-out
            </label>
          </div>
        </fieldset>
        <div>
          <label htmlFor="manual-reason" className="mb-1 block text-xs font-medium text-theme">
            Reason
          </label>
          <select
            id="manual-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input-field w-full"
          >
            {MANUAL_ATTENDANCE_REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="manual-note" className="mb-1 block text-xs font-medium text-theme">
            Note {reason === "other" ? "(required)" : "(optional)"}
          </label>
          <textarea
            id="manual-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="input-field w-full"
            placeholder={reason === "other" ? "Describe the situation…" : "Optional context…"}
          />
        </div>
        <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: "var(--border-soft)" }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
