"use client";

import { useEffect, useState } from "react";
import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";
import * as platformApi from "@/lib/api/platform.api";
import { isApiError } from "@/lib/types/api";

export default function PlatformSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportWhatsAppUrl, setSupportWhatsAppUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await platformApi.getSupportSettings();
        if (cancelled) return;
        if (isApiError(res)) {
          setError(res.error ?? "Failed to load support settings");
          return;
        }
        const d = res.data;
        setSupportEmail(d?.support_email ?? "");
        setSupportPhone(d?.support_phone ?? "");
        setSupportWhatsAppUrl(d?.support_whatsapp_url ?? "");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load support settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setOk(null);
    const res = await platformApi.updateSupportSettings({
      support_email: supportEmail.trim() || null,
      support_phone: supportPhone.trim() || null,
      support_whatsapp_url: supportWhatsAppUrl.trim() || null,
    });
    setSaving(false);
    if (isApiError(res)) {
      setError(res.error ?? "Failed to save support settings");
      return;
    }
    setOk("Saved.");
  }

  return (
    <MainContent title="System Settings">
      <Card title="Platform Settings">
        <p className="text-sm text-theme-muted">
          Platform-wide support details shown in the in-app Support launcher.
        </p>

        {error ? <div className="alert-error mt-3 px-3 py-2">{error}</div> : null}
        {ok ? <div className="alert-success mt-3 px-3 py-2">{ok}</div> : null}

        {loading ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </p>
        ) : (
          <div className="mt-4 grid gap-4 max-w-lg">
            <div>
              <label className="mb-1 block text-sm font-medium text-theme" htmlFor="support_email">
                Support email
              </label>
              <input
                id="support_email"
                className="input-field w-full"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@yourdomain.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-theme" htmlFor="support_phone">
                Support phone
              </label>
              <input
                id="support_phone"
                className="input-field w-full"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+1 555 123 4567"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-theme" htmlFor="support_whatsapp_url">
                WhatsApp URL
              </label>
              <input
                id="support_whatsapp_url"
                className="input-field w-full"
                value={supportWhatsAppUrl}
                onChange={(e) => setSupportWhatsAppUrl(e.target.value)}
                placeholder="https://wa.me/15551234567"
              />
              <p className="mt-1 text-xs text-theme-muted">
                Tip: use <code className="font-mono">https://wa.me/&lt;number&gt;</code> or your WhatsApp short link.
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="btn-primary rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save support settings"}
              </button>
            </div>
          </div>
        )}
      </Card>
    </MainContent>
  );
}
