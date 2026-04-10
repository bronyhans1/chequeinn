"use client";

import { MainContent } from "@/components/layout/MainContent";
import { Card } from "@/components/ui/Card";

export default function PlatformAuditPage() {
  return (
    <MainContent title="Platform Audit Logs">
      <Card title="Audit Logs">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Platform-wide audit exploration is reserved for the next iteration.
          The Platform Dashboard already surfaces recent cross-company activity for quick triage.
        </p>
      </Card>
    </MainContent>
  );
}
