"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// Article XVIII "Users own their data. Users can export it." — a single
// JSON download of everything the workspace owns (src/lib/export/account-export.ts).
export function DataExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    setIsExporting(true);
    try {
      const res = await fetch("/api/team/export-data");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "We couldn't export your data.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] ?? "workspace-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Card interactive>
      <h2 className="mb-1 text-lg font-medium text-[var(--color-text-primary)]">Export Your Data</h2>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Download everything this workspace owns — Growth Blueprints, prospects, campaigns,
        tasks, goals, SEO content, and your Business Memory — as a single JSON file.
      </p>
      <FormError message={error} />
      <Button onClick={handleExport} disabled={isExporting}>
        {isExporting ? "Preparing export…" : "Export workspace data"}
      </Button>
    </Card>
  );
}
