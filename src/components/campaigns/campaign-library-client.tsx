"use client";

import { useState } from "react";
import Link from "next/link";
import type { CampaignTemplate } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/form-error";
import { SplitHeading } from "@/components/motion/split-heading";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "COLD_OUTREACH", label: "Cold Outreach" },
  { value: "REFERRAL_REQUESTS", label: "Referral Requests" },
  { value: "PARTNERSHIPS", label: "Partnerships" },
  { value: "WEBSITE_AUDITS", label: "Website Audits" },
  { value: "CONSULTATION_OFFERS", label: "Consultation Offers" },
  { value: "PRODUCT_LAUNCHES", label: "Product Launches" },
];

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function CampaignLibraryClient({ initialTemplates }: { initialTemplates: CampaignTemplate[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; category: string; objective: string; abTest: boolean } | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEdit(template: CampaignTemplate) {
    setError(null);
    setEditingId(template.id);
    setDraft({
      name: template.name,
      category: template.category,
      objective: template.objective,
      abTest: template.abTest,
    });
  }

  async function saveEdit(templateId: string) {
    if (!draft) return;
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/campaign-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setTemplates((prev) => prev.map((t) => (t.id === templateId ? body.template : t)));
      setEditingId(null);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTemplate(templateId: string) {
    setError(null);
    setDeletingId(templateId);
    try {
      const res = await fetch(`/api/campaign-templates/${templateId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SplitHeading
            as="h1"
            text="Campaign Library"
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Reusable campaign templates, saved from any campaign you&apos;ve built. Editable
            anytime.
          </p>
        </div>
        <Link href="/campaigns" className="mt-1 text-sm text-[var(--color-accent-text)] hover:underline">
          ← Campaigns
        </Link>
      </div>

      <FormError message={error} />

      {templates.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No templates yet. Open a campaign and click &ldquo;Save as Template&rdquo; to add one
          here.
        </p>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const isEditing = editingId === template.id;
            return (
              <Card key={template.id}>
                {isEditing && draft ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[var(--color-text-muted)]">Name</label>
                      <Input
                        aria-label="Name"
                        className="mt-1"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--color-text-muted)]">Category</label>
                      <select
                        aria-label="Category"
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                        className="mt-1 h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--color-text-muted)]">Objective</label>
                      <Input
                        aria-label="Objective"
                        className="mt-1"
                        value={draft.objective}
                        onChange={(e) => setDraft({ ...draft, objective: e.target.value })}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={draft.abTest}
                        onChange={(e) => setDraft({ ...draft, abTest: e.target.checked })}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      Test two message angles (A/B) by default
                    </label>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(template.id)} disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setDraft(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge tone="accent">{categoryLabel(template.category)}</Badge>
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {template.name}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          {template.objective}
                        </p>
                        {template.abTest && (
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            A/B testing enabled by default
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        href={`/campaigns/new?templateId=${template.id}`}
                        className="text-sm text-[var(--color-accent-text)] hover:underline"
                      >
                        Use Template →
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(template)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => deleteTemplate(template.id)}
                        disabled={deletingId === template.id}
                      >
                        {deletingId === template.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
