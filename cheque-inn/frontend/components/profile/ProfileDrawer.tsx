"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import * as authApi from "@/lib/api/auth.api";
import { isApiError } from "@/lib/types/api";
import { supabase } from "@/lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfileDrawer({ open, onClose }: Props) {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [themePreference, setThemePreference] = useState<"light" | "dark" | "system">("system");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setPhoneNumber(user.phoneNumber ?? "");
    setDateOfBirth(user.dateOfBirth ?? "");
    setGender(user.gender ?? "");
    setPhotoUrl(user.profilePhotoUrl ?? "");
    setThemePreference(user.themePreference ?? "system");
    setPassword("");
    setError(null);
    setMessage(null);
  }, [user, open]);

  const roleLabel = useMemo(() => (user?.roles?.length ? user.roles.join(", ") : "—"), [user?.roles]);
  const isPlatformAdmin = !!user?.roles?.includes("PLATFORM_ADMIN");
  const checklist = useMemo(() => {
    if (!user) {
      return { items: [], completed: 0, total: 1 };
    }
    const c = user.profileCompletion;
    const requiredDone = !c.missingRequiredFields.includes("password");
    const dobDone = !c.missingRequiredFields.includes("date_of_birth");
    const phoneDone = !c.recommendedMissingFields.includes("phone_number");
    const genderDone = !c.recommendedMissingFields.includes("gender");
    const photoDone = !c.recommendedMissingFields.includes("profile_photo_url");
    const items = [
      { key: "password", label: "Password updated", required: true, done: requiredDone },
      { key: "dob", label: "Date of birth provided", required: true, done: dobDone },
      { key: "phone", label: "Telephone added", required: false, done: phoneDone },
      { key: "gender", label: "Gender added", required: false, done: genderDone },
      { key: "photo", label: "Profile photo added", required: false, done: photoDone },
    ];
    const completed = items.filter((i) => i.done).length;
    return { items, completed, total: items.length };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = themePreference === "dark" || (themePreference === "system" && systemDark);
    root.classList.toggle("dark", dark);
    localStorage.setItem("cheque_inn_theme_pref", themePreference);
  }, [themePreference, open]);

  if (!open || !user) return null;

  async function handlePhotoUpload(file: File) {
    if (!user) return;
    if (!supabase) {
      setError("Cannot upload photo: Supabase is not configured.");
      return;
    }
    setUploadingPhoto(true);
    setError(null);
    const extension = file.name.split(".").pop() || "jpg";
    const path = `profile-photos/${user.userId}-${Date.now()}.${extension}`;
    const { error: upErr } = await supabase.storage
      .from("profile-photos")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (upErr) {
      setUploadingPhoto(false);
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    setPhotoUrl(data.publicUrl);
    setUploadingPhoto(false);
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await authApi.updateMyProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone_number: phoneNumber.trim() || null,
      date_of_birth: dateOfBirth.trim() || null,
      gender: (gender || null) as "male" | "female" | "other" | "prefer_not_to_say" | null,
      profile_photo_url: photoUrl.trim() || null,
      theme_preference: themePreference,
    });
    if (isApiError(res)) {
      setError(res.error ?? "Failed to update profile");
      setSaving(false);
      return;
    }

    if (password.trim()) {
      if (!supabase) {
        setError("Cannot update password: Supabase not configured.");
        setSaving(false);
        return;
      }
      const { error: passErr } = await supabase.auth.updateUser({ password: password.trim() });
      if (passErr) {
        setError(passErr.message);
        setSaving(false);
        return;
      }
      await authApi.markPasswordChanged();
    }

    await refreshUser();
    setPassword("");
    setSaving(false);
    setMessage("Profile updated successfully.");
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close profile drawer overlay"
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{ background: "var(--overlay-scrim)" }}
      />
      <aside
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l p-5"
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-drawer)",
        }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>My profile</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Update your personal account details</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors duration-150 hover:bg-[var(--nav-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        <div
          className="mb-4 rounded-xl border p-4"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/45 dark:text-primary-200">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-base font-semibold">
                  {(firstName?.[0] ?? user.email[0] ?? "U").toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
                {[firstName, lastName].filter(Boolean).join(" ").trim() || user.email}
              </p>
              <p className="truncate text-sm" style={{ color: "var(--text-muted)" }}>{roleLabel}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <p>Email: {user.email}</p>
            {isPlatformAdmin ? (
              <>
                <p>Scope: Platform</p>
                <p>Access: Platform Administrator</p>
              </>
            ) : (
              <>
                <p>Company: {user.companyName || "—"}</p>
                <p>Branch: {user.branch?.name ?? "—"}</p>
                <p>Department: {user.department?.name ?? "—"}</p>
              </>
            )}
          </div>
        </div>

        {error ? (
          <p
            className="mb-3 rounded-lg border px-3 py-2 text-sm font-medium"
            style={{
              borderColor: "var(--state-error-border)",
              background: "var(--state-error-bg)",
              color: "var(--state-error-text)",
            }}
          >
            {error}
          </p>
        ) : null}
        {message ? (
          <p
            className="mb-3 rounded-lg border px-3 py-2 text-sm font-medium"
            style={{
              borderColor: "var(--state-success-border)",
              background: "var(--state-success-bg)",
              color: "var(--state-success-text)",
            }}
          >
            {message}
          </p>
        ) : null}

        <div className="mb-4 rounded-xl border p-3" style={{ borderColor: "var(--border-soft)", background: "var(--surface-muted)" }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Profile completion</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {checklist.completed}/{checklist.total}
            </p>
          </div>
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--border-soft)" }}>
            <div
              className="h-full rounded bg-primary-600 transition-all duration-300"
              style={{ width: `${(checklist.completed / checklist.total) * 100}%` }}
            />
          </div>
          <ul className="space-y-1.5">
            {checklist.items.map((item) => (
              <li key={item.key} className="flex items-center justify-between text-xs">
                <span style={{ color: item.done ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {item.done ? "✓" : "○"} {item.label}
                </span>
                {item.required ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
                    Required
                  </span>
                ) : (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    Recommended
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <Input label="First name" value={firstName} onChange={setFirstName} />
          <Input label="Last name" value={lastName} onChange={setLastName} />
          <Input label="Telephone" value={phoneNumber} onChange={setPhoneNumber} />
          <Input label="Date of birth" type="date" value={dateOfBirth} onChange={setDateOfBirth} />
          <Select
            label="Gender"
            value={gender}
            onChange={setGender}
            options={[
              { value: "", label: "Prefer not to say" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
              { value: "prefer_not_to_say", label: "Prefer not to say" },
            ]}
          />
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-muted)" }}>Upload photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePhotoUpload(file);
              }}
              className="w-full text-sm"
            />
            {uploadingPhoto ? (
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Uploading photo…</p>
            ) : null}
          </div>
          <Select
            label="Theme preference"
            value={themePreference}
            onChange={(v) => setThemePreference(v as "light" | "dark" | "system")}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-muted)" }}>New password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pr-16"
                placeholder="Leave blank to keep current"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 my-auto h-7 rounded-lg px-2 text-xs font-medium transition-colors duration-150 hover:bg-[var(--nav-hover)]"
                style={{ color: "var(--text-muted)" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Updating password clears the required password change flag.
            </p>
          </div>
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="btn-primary w-full rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </aside>
    </>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
