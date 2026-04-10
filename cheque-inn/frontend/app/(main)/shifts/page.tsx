"use client";

import { useCallback, useEffect, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth/AuthContext";
import { hasRole, ADMIN_MANAGER_ROLES } from "@/lib/auth/roles";
import * as shiftsApi from "@/lib/api/shifts.api";
import { isApiError } from "@/lib/types/api";
import type { Shift } from "@/lib/api/shifts.api";

export default function ShiftsPage() {
  const { user } = useAuth();
  const canManage = hasRole(user?.roles, ADMIN_MANAGER_ROLES);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null);

  const [formName, setFormName] = useState("");
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("17:00");
  const [formGrace, setFormGrace] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await shiftsApi.getShifts();
      if (isApiError(res)) {
        setError(res.error ?? "Failed to load shifts");
        setShifts([]);
        return;
      }
      setShifts(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load shifts");
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setFormName("");
    setFormStart("09:00");
    setFormEnd("17:00");
    setFormGrace("0");
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(shift: Shift) {
    setEditShift(shift);
    setFormName(shift.name);
    setFormStart(shift.start_time?.slice(0, 5) || "09:00");
    setFormEnd(shift.end_time?.slice(0, 5) || "17:00");
    setFormGrace(String(shift.grace_minutes ?? 0));
    setFormError(null);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    const grace = parseInt(formGrace, 10);
    if (Number.isNaN(grace) || grace < 0) {
      setFormError("Grace minutes must be 0 or greater.");
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await shiftsApi.createShift({
        name,
        start_time: formStart,
        end_time: formEnd,
        grace_minutes: grace,
      });
      if (isApiError(res)) {
        setFormError(res.error ?? "Failed to create shift");
        return;
      }
      setAddOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create shift");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editShift) return;
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    const grace = parseInt(formGrace, 10);
    if (Number.isNaN(grace) || grace < 0) {
      setFormError("Grace minutes must be 0 or greater.");
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await shiftsApi.updateShift(editShift.id, {
        name,
        start_time: formStart,
        end_time: formEnd,
        grace_minutes: grace,
      });
      if (isApiError(res)) {
        setFormError(res.error ?? "Failed to update shift");
        return;
      }
      setEditShift(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to update shift");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteShift) return;
    setActionLoading(deleteShift.id);
    try {
      const res = await shiftsApi.deleteShift(deleteShift.id);
      if (isApiError(res)) {
        setError(res.error ?? "Failed to delete shift");
        return;
      }
      setDeleteShift(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete shift");
    } finally {
      setActionLoading(null);
    }
  }

  const columns: { key: string; header: string; render?: (row: Shift) => React.ReactNode }[] = [
    { key: "name", header: "Name" },
    { key: "start_time", header: "Start" },
    { key: "end_time", header: "End" },
    {
      key: "grace_minutes",
      header: "Grace (min)",
      render: (row: Shift) => row.grace_minutes ?? 0,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (row: Shift) => (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteShift(row)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  if (loading && shifts.length === 0) {
    return (
      <MainContent title="Shifts">
        <LoadingState message="Loading shifts…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  if (error && shifts.length === 0) {
    return (
      <MainContent title="Shifts">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  return (
    <MainContent title="Shifts">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-theme-muted">
          {shifts.length} shift{shifts.length !== 1 ? "s" : ""} in your company.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={openAdd}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Add Shift
          </button>
        )}
      </div>
      <Card title="Shift list" className="mt-4">
        {shifts.length === 0 ? (
          <EmptyState
            message={
              canManage
                ? "No shifts yet. Use Add Shift to create one."
                : "No shifts defined."
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={shifts}
            keyExtractor={(row) => row.id}
            emptyMessage="No shifts"
          />
        )}
      </Card>

      {canManage && (
        <>
        <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Shift">
          <form onSubmit={handleAddSubmit} className="space-y-4">
            {formError && (
              <div className="alert-error px-3 py-2">
                {formError}
              </div>
            )}
            <div>
              <label htmlFor="add-shift-name" className="mb-1 block text-sm font-medium text-theme">
                Name
              </label>
              <input
                id="add-shift-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="input-field w-full"
                placeholder="e.g. Morning, Day Shift"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="add-shift-start" className="mb-1 block text-sm font-medium text-theme">
                  Start time
                </label>
                <input
                  id="add-shift-start"
                  type="time"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                  required
                  className="input-field w-full"
                />
              </div>
              <div>
                <label htmlFor="add-shift-end" className="mb-1 block text-sm font-medium text-theme">
                  End time
                </label>
                <input
                  id="add-shift-end"
                  type="time"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                  required
                  className="input-field w-full"
                />
              </div>
            </div>
            <div>
              <label htmlFor="add-shift-grace" className="mb-1 block text-sm font-medium text-theme">
                Grace minutes (late clock-in allowed)
              </label>
              <input
                id="add-shift-grace"
                type="number"
                min={0}
                value={formGrace}
                onChange={(e) => setFormGrace(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {formSubmitting ? "Adding…" : "Add Shift"}
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          open={!!editShift}
          onClose={() => setEditShift(null)}
          title="Edit Shift"
        >
          {editShift && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {formError && (
                <div className="alert-error px-3 py-2">
                  {formError}
                </div>
              )}
              <div>
                <label htmlFor="edit-shift-name" className="mb-1 block text-sm font-medium text-theme">
                  Name
                </label>
                <input
                  id="edit-shift-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="input-field w-full"
                  placeholder="e.g. Morning, Day Shift"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-shift-start" className="mb-1 block text-sm font-medium text-theme">
                    Start time
                  </label>
                  <input
                    id="edit-shift-start"
                    type="time"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    required
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label htmlFor="edit-shift-end" className="mb-1 block text-sm font-medium text-theme">
                    End time
                  </label>
                  <input
                    id="edit-shift-end"
                    type="time"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    required
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="edit-shift-grace" className="mb-1 block text-sm font-medium text-theme">
                  Grace minutes (late clock-in allowed)
                </label>
                <input
                  id="edit-shift-grace"
                  type="number"
                  min={0}
                  value={formGrace}
                  onChange={(e) => setFormGrace(e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditShift(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {formSubmitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          )}
        </Modal>
        </>
      )}

      <Modal
        open={!!deleteShift}
        onClose={() => setDeleteShift(null)}
        title="Delete Shift"
      >
        {deleteShift && (
          <div className="space-y-4">
            <p className="text-sm text-theme-muted">
              Are you sure you want to delete &quot;{deleteShift.name}&quot;? Employees assigned to this shift will need to be reassigned.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteShift(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={actionLoading === deleteShift.id}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === deleteShift.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </MainContent>
  );
}
