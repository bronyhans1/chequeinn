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
import { hasRole, ADMIN_MANAGER_ROLES, canAccessAdminFeatures } from "@/lib/auth/roles";
import * as departmentsApi from "@/lib/api/departments.api";
import * as branchesApi from "@/lib/api/branches.api";
import { isApiError } from "@/lib/types/api";
import type { Department } from "@/lib/api/departments.api";
import type { BranchDto } from "@/lib/api/branches.api";
import { ApiClientError } from "@/lib/api/client";
import { useToast } from "@/components/ui/ToastProvider";

export default function DepartmentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = hasRole(user?.roles, ADMIN_MANAGER_ROLES);
  const isAdmin = canAccessAdminFeatures(user?.roles);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [deleteDepartment, setDeleteDepartment] = useState<Department | null>(null);

  const [formName, setFormName] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    setError(null);
    setLoading(true);
    try {
      const depRes = await departmentsApi.getDepartments();
      if (isApiError(depRes)) {
        setError(depRes.error ?? "Failed to load departments");
        setDepartments([]);
        return;
      }
      setDepartments(depRes.data ?? []);
      try {
        const brRes = await branchesApi.getBranches();
        if (!isApiError(brRes)) {
          setBranches(brRes.data ?? []);
        } else {
          setBranches([]);
        }
      } catch {
        setBranches([]);
      }
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to load departments"
      );
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  function defaultBranchId(): string {
    const d = branches.find((b) => b.is_default);
    return d?.id ?? branches[0]?.id ?? "";
  }

  function openAdd() {
    setFormName("");
    setFormBranchId(defaultBranchId());
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(department: Department) {
    setEditDepartment(department);
    setFormName(department.name);
    setFormBranchId(department.branch_id ?? defaultBranchId());
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
    setFormSubmitting(true);
    try {
      const res = await departmentsApi.createDepartment({
        name,
        ...(formBranchId.trim() ? { branch_id: formBranchId.trim() } : {}),
      });
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to create department";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      setAddOpen(false);
      toast.success("Department created successfully");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create department";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editDepartment) return;
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await departmentsApi.updateDepartment(editDepartment.id, {
        name,
        ...(isAdmin && formBranchId.trim() ? { branch_id: formBranchId.trim() } : {}),
      });
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to update department";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      setEditDepartment(null);
      toast.success("Department updated successfully");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update department";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteDepartment) return;
    setActionLoading(deleteDepartment.id);
    try {
      const res = await departmentsApi.deleteDepartment(deleteDepartment.id);
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to delete department";
        setError(msg);
        toast.error(msg);
        return;
      }
      setDeleteDepartment(null);
      toast.success("Department deleted successfully");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete department";
      setError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  }

  const columns = [
    { key: "name", header: "Name" },
    {
      key: "branch",
      header: "Branch",
      render: (row: Department) => row.branch?.name ?? "—",
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (row: Department) => (
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
                  onClick={() => setDeleteDepartment(row)}
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

  if (!canManage) {
    return (
      <MainContent title="Departments">
        <ErrorState message="You don't have permission to manage departments." />
      </MainContent>
    );
  }

  if (loading && departments.length === 0) {
    return (
      <MainContent title="Departments">
        <LoadingState message="Loading departments…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  if (error && departments.length === 0) {
    return (
      <MainContent title="Departments">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  return (
    <MainContent title="Departments">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-theme-muted">
          {departments.length} department{departments.length !== 1 ? "s" : ""}{" "}
          {isAdmin ? "in your company." : "in your branch."} Attendance QR and GPS are configured per{" "}
          <strong>branch</strong>, not here.
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Add department
        </button>
      </div>
      <Card title="Department list" className="mt-4">
        {departments.length === 0 ? (
          <EmptyState message="No departments yet. Use Add department to create one." />
        ) : (
          <DataTable
            columns={columns}
            data={departments}
            keyExtractor={(row) => row.id}
            emptyMessage="No departments"
          />
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add department">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="alert-error px-3 py-2">
              {formError}
            </div>
          )}
          <div>
            <label htmlFor="add-dept-name" className="mb-1 block text-sm font-medium text-theme">
              Name
            </label>
            <input
              id="add-dept-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="input-field w-full"
              placeholder="e.g. Finance, Sales"
            />
          </div>
          <div>
            <label htmlFor="add-dept-branch" className="mb-1 block text-sm font-medium text-theme">
              Branch
            </label>
            <select
              id="add-dept-branch"
              value={formBranchId}
              onChange={(e) => setFormBranchId(e.target.value)}
              className="input-field w-full"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.is_default ? " (default)" : ""}
                </option>
              ))}
            </select>
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
              {formSubmitting ? "Adding…" : "Add department"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editDepartment}
        onClose={() => setEditDepartment(null)}
        title="Edit department"
      >
        {editDepartment && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <div className="alert-error px-3 py-2">
                {formError}
              </div>
            )}
            <div>
              <label htmlFor="edit-dept-name" className="mb-1 block text-sm font-medium text-theme">
                Name
              </label>
              <input
                id="edit-dept-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="input-field w-full"
                placeholder="e.g. HQ"
              />
            </div>
            {isAdmin ? (
              <div>
                <label htmlFor="edit-dept-branch" className="mb-1 block text-sm font-medium text-theme">
                  Branch
                </label>
                <select
                  id="edit-dept-branch"
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  className="input-field w-full"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.is_default ? " (default)" : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-theme-muted">Only company admins can move a department to another branch.</p>
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditDepartment(null)}
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

      <Modal
        open={!!deleteDepartment}
        onClose={() => setDeleteDepartment(null)}
        title="Delete department"
      >
        {deleteDepartment && (
          <div className="space-y-4">
            <p className="text-sm text-theme-muted">
              Are you sure you want to delete &quot;{deleteDepartment.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteDepartment(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={actionLoading === deleteDepartment.id}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === deleteDepartment.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </MainContent>
  );
}
