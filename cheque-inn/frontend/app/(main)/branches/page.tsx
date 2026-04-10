"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth/AuthContext";
import { canAccessAdminFeatures } from "@/lib/auth/roles";
import * as branchesApi from "@/lib/api/branches.api";
import type { BranchDto, PatchBranchInput } from "@/lib/api/branches.api";
import { isApiError } from "@/lib/types/api";
import { ApiClientError } from "@/lib/api/client";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/components/ui/ToastProvider";

const PRINT_QR_SIZE_PX = 280;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function BranchesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = canAccessAdminFeatures(user?.roles);

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchDto | null>(null);
  const [deleteBranch, setDeleteBranch] = useState<BranchDto | null>(null);
  const [qrBranch, setQrBranch] = useState<BranchDto | null>(null);

  const [formName, setFormName] = useState("");
  const [formLat, setFormLat] = useState("");
  const [formLng, setFormLng] = useState("");
  const [formRadius, setFormRadius] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setError(null);
    setLoading(true);
    try {
      const res = await branchesApi.getBranches();
      if (isApiError(res)) {
        setError(res.error ?? "Failed to load branches");
        setBranches([]);
        return;
      }
      setBranches(res.data ?? []);
    } catch (e) {
      const msg =
        e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "Failed to load branches";
      setError(msg);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setFormName("");
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(b: BranchDto) {
    setEditBranch(b);
    setFormName(b.name);
    setFormLat(b.latitude != null ? String(b.latitude) : "");
    setFormLng(b.longitude != null ? String(b.longitude) : "");
    setFormRadius(b.radius_meters != null ? String(b.radius_meters) : "");
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
      const res = await branchesApi.createBranch(name);
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to create branch";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      setAddOpen(false);
      toast.success("Branch created successfully");
      await load();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Failed to create branch";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editBranch) return;
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    setFormSubmitting(true);
    try {
      const latTrim = formLat.trim();
      const lngTrim = formLng.trim();
      const radTrim = formRadius.trim();
      const payload: PatchBranchInput = { name };
      if (latTrim !== "") {
        const n = Number(latTrim);
        if (Number.isNaN(n)) {
          setFormError("Latitude must be a number.");
          setFormSubmitting(false);
          return;
        }
        payload.latitude = n;
      }
      if (lngTrim !== "") {
        const n = Number(lngTrim);
        if (Number.isNaN(n)) {
          setFormError("Longitude must be a number.");
          setFormSubmitting(false);
          return;
        }
        payload.longitude = n;
      }
      if (radTrim !== "") {
        const n = Number(radTrim);
        if (Number.isNaN(n) || n < 0) {
          setFormError("Radius must be a non-negative number (meters).");
          setFormSubmitting(false);
          return;
        }
        payload.radius_meters = n;
      }

      const res = await branchesApi.patchBranch(editBranch.id, payload);
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to update branch";
        setFormError(msg);
        toast.error(msg);
        return;
      }
      setEditBranch(null);
      toast.success("Branch updated successfully");
      await load();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Failed to update branch";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteBranch) return;
    setActionLoading(deleteBranch.id);
    try {
      const res = await branchesApi.deleteBranch(deleteBranch.id);
      if (isApiError(res)) {
        const msg = res.error ?? "Failed to delete branch";
        setError(msg);
        toast.error(msg);
        return;
      }
      setDeleteBranch(null);
      toast.success("Branch deleted successfully");
      await load();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Failed to delete branch";
      setError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  }

  const columns = [
    { key: "name", header: "Name" },
    {
      key: "is_default",
      header: "Default",
      render: (row: BranchDto) =>
        row.is_default ? <Badge variant="success">Default</Badge> : <span className="text-theme-muted">—</span>,
    },
    {
      key: "attendance",
      header: "Attendance site",
      render: (row: BranchDto) =>
        row.latitude != null && row.longitude != null ? (
          <span className="text-xs text-theme-muted">GPS set · radius {row.radius_meters ?? 50}m</span>
        ) : (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Configure GPS
          </span>
        ),
    },
    {
      key: "qr_code",
      header: "QR",
      render: (row: BranchDto) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-theme-muted" title={row.qr_code ?? ""}>
            {row.qr_code ? `${row.qr_code.slice(0, 18)}…` : "—"}
          </span>
          {row.qr_code ? (
            <button
              type="button"
              onClick={() => setQrBranch(row)}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              View QR
            </button>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: BranchDto) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Edit
          </button>
          {!row.is_default ? (
            <button
              type="button"
              onClick={() => setDeleteBranch(row)}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Delete
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const qrMeta = useMemo(() => {
    if (!qrBranch) return null;
    return {
      companyName: user?.companyName ?? "Company",
      branchName: qrBranch.name,
      payload: qrBranch.qr_code ?? "",
    };
  }, [qrBranch, user?.companyName]);

  function handleDownloadQrSvg() {
    if (!qrMeta || !qrContainerRef.current) return;
    const svg = qrContainerRef.current.querySelector("svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${qrMeta.companyName}-${qrMeta.branchName}-attendance-qr.svg`.replace(/\s+/g, "_");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handlePrintQr() {
    if (!qrMeta || !qrContainerRef.current) return;
    const svg = qrContainerRef.current.querySelector("svg");
    if (!svg) {
      toast.error("QR code is not ready to print yet.");
      return;
    }

    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("width", String(PRINT_QR_SIZE_PX));
    clone.setAttribute("height", String(PRINT_QR_SIZE_PX));
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }

    const serializer = new XMLSerializer();
    const svgMarkup = serializer.serializeToString(clone);
    if (!svgMarkup.trim()) {
      toast.error("Could not read the QR image for printing.");
      return;
    }

    /**
     * Open a real navigation to an HTML blob instead of mutating an about:blank
     * subframe via `document.write`. With `noopener`/`Cross-Origin-Opener-Policy`,
     * the handle returned by `window.open("", ...)` is often not reliably writable,
     * which leaves a blank tab. Navigating to a blob URL loads this document normally.
     */
    const title = `${qrMeta.branchName} — Branch Attendance QR`;
    const docHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111827;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      padding: 28px 20px 32px;
    }
    .sheet {
      max-width: 520px;
      margin: 0 auto;
      text-align: center;
    }
    .company {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 0 6px;
      line-height: 1.3;
    }
    .branch {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0 0 18px;
      color: #374151;
      line-height: 1.35;
    }
    .product-label {
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #4b5563;
      margin: 0 0 14px;
    }
    .qr-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 4px auto 22px;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      width: fit-content;
      max-width: 100%;
      margin-inline: auto;
      background: #fff;
    }
    .qr-wrap svg {
      display: block;
      max-width: 100%;
      height: auto;
    }
    .hint {
      font-size: 0.8125rem;
      line-height: 1.5;
      color: #6b7280;
      margin: 0 auto;
      max-width: 380px;
    }
    @page {
      margin: 14mm;
      size: auto;
    }
    @media print {
      body { padding: 12px 8px 20px; }
      .qr-wrap { border-color: #d1d5db; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <p class="company">${escapeHtml(qrMeta.companyName)}</p>
    <p class="branch">${escapeHtml(qrMeta.branchName)}</p>
    <p class="product-label">Branch Attendance QR</p>
    <div class="qr-wrap">${svgMarkup}</div>
    <p class="hint">Scan this code for attendance at this branch. Use for employee check-in and check-out at this location.</p>
  </div>
</body>
</html>`;

    const blob = new Blob([docHtml], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);

    const features = "width=900,height=800,scrollbars=yes";
    const win = window.open(blobUrl, "_blank", features);
    if (!win) {
      URL.revokeObjectURL(blobUrl);
      toast.error("Could not open the print window. Allow pop-ups for this site and try again.");
      return;
    }

    const revokeSoon = () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        /* ignore */
      }
    };
    win.addEventListener("afterprint", revokeSoon, { once: true });
    window.setTimeout(revokeSoon, 120_000);

    const runPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        toast.error("Print could not start.");
      }
    };

    if (win.document.readyState === "complete") {
      window.setTimeout(runPrint, 50);
    } else {
      win.addEventListener(
        "load",
        () => window.setTimeout(runPrint, 50),
        { once: true }
      );
    }
  }

  if (!isAdmin) {
    return (
      <MainContent title="Branches">
        <ErrorState message="Only company admins can manage branches." />
      </MainContent>
    );
  }

  if (loading && branches.length === 0) {
    return (
      <MainContent title="Branches">
        <LoadingState message="Loading branches…" className="min-h-[200px]" />
      </MainContent>
    );
  }

  if (error && branches.length === 0) {
    return (
      <MainContent title="Branches">
        <ErrorState message={error} onRetry={load} />
      </MainContent>
    );
  }

  return (
    <MainContent title="Branches">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-theme-muted">
          {branches.length} branch{branches.length !== 1 ? "es" : ""}. Each branch is the physical attendance
          site (QR + GPS). Set latitude, longitude, and radius under Edit. The default branch cannot be
          deleted; remove all users and departments from a branch before deleting it.
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Add branch
        </button>
      </div>
      {error ? (
        <p className="callout-warning mt-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Card title="Branch list" className="mt-4">
        {branches.length === 0 ? (
          <EmptyState message="No branches found." />
        ) : (
          <DataTable
            columns={columns}
            data={branches}
            keyExtractor={(row) => row.id}
            emptyMessage="No branches"
          />
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add branch">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="alert-error px-3 py-2">{formError}</div>
          )}
          <div>
            <label htmlFor="add-branch-name" className="mb-1 block text-sm font-medium text-theme">
              Name
            </label>
            <input
              id="add-branch-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="input-field w-full"
              placeholder="e.g. North Campus"
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
              {formSubmitting ? "Adding…" : "Add branch"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editBranch} onClose={() => setEditBranch(null)} title="Edit branch">
        {editBranch && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {formError && (
              <div className="alert-error px-3 py-2">{formError}</div>
            )}
            <p className="text-xs text-theme-muted">
              Check-in QR value:{" "}
              <span className="font-mono text-theme">{editBranch.qr_code ?? "—"}</span>
            </p>
            <div>
              <label htmlFor="edit-branch-name" className="mb-1 block text-sm font-medium text-theme">
                Name
              </label>
              <input
                id="edit-branch-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="input-field w-full"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="edit-branch-lat" className="mb-1 block text-sm font-medium text-theme">
                  Latitude
                </label>
                <input
                  id="edit-branch-lat"
                  type="text"
                  inputMode="decimal"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  placeholder="e.g. -26.2041"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label htmlFor="edit-branch-lng" className="mb-1 block text-sm font-medium text-theme">
                  Longitude
                </label>
                <input
                  id="edit-branch-lng"
                  type="text"
                  inputMode="decimal"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  placeholder="e.g. 28.0473"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label htmlFor="edit-branch-rad" className="mb-1 block text-sm font-medium text-theme">
                  Radius (m)
                </label>
                <input
                  id="edit-branch-rad"
                  type="text"
                  inputMode="numeric"
                  value={formRadius}
                  onChange={(e) => setFormRadius(e.target.value)}
                  placeholder="default 50"
                  className="input-field w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditBranch(null)}
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

      <Modal open={!!deleteBranch} onClose={() => setDeleteBranch(null)} title="Delete branch">
        {deleteBranch && (
          <div className="space-y-4">
            <p className="text-sm text-theme-muted">
              Delete &quot;{deleteBranch.name}&quot;? This only works if no users or departments are assigned to
              it.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteBranch(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={actionLoading === deleteBranch.id}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === deleteBranch.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!qrBranch} onClose={() => setQrBranch(null)} title="Branch Attendance QR">
        {qrMeta ? (
          <div className="space-y-4">
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {qrMeta.branchName}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {qrMeta.companyName}
              </p>
            </div>
            <div
              ref={qrContainerRef}
              className="qr-code-pad flex items-center justify-center rounded-lg border p-5"
              style={{ borderColor: "var(--border-soft)" }}
            >
              <QRCodeSVG value={qrMeta.payload} size={220} level="M" includeMargin />
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Branch QR is the attendance QR. Post this at the branch check-in location.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDownloadQrSvg}
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border-soft)", color: "var(--text-primary)" }}
              >
                Download SVG
              </button>
              <button
                type="button"
                onClick={handlePrintQr}
                className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Print
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </MainContent>
  );
}
