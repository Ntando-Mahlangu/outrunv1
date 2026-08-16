"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Company } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-error";
import { ScoreBadge } from "@/components/prospects/score-badge";
import {
  FilterBar,
  DEFAULT_PROSPECT_FILTERS,
  applyProspectFilters,
  type ProspectFilters,
} from "@/components/prospects/filter-bar";
import { BulkActionsBar } from "@/components/prospects/bulk-actions-bar";
import { CountUp } from "@/components/motion/count-up";

export function LeadListDetailClient({
  listId,
  initialName,
  initialCompanies,
}: {
  listId: string;
  initialName: string;
  initialCompanies: Company[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [companies, setCompanies] = useState(initialCompanies);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProspectFilters>(DEFAULT_PROSPECT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categories = useMemo(
    () => Array.from(new Set(companies.map((c) => c.category).filter((c): c is string => Boolean(c)))).sort(),
    [companies],
  );
  const filteredCompanies = useMemo(
    () => applyProspectFilters(companies, filters),
    [companies, filters],
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function rename() {
    setError(null);
    setIsRenaming(true);
    try {
      const res = await fetch(`/api/lead-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setSavedName(body.list.name);
      setName(body.list.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsRenaming(false);
    }
  }

  async function removeCompany(companyId: string) {
    setError(null);
    setRemovingId(companyId);
    try {
      const res = await fetch(`/api/prospects/${companyId}/lists`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadListId: listId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRemovingId(null);
    }
  }

  async function removeSelected() {
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((companyId) =>
        fetch(`/api/prospects/${companyId}/lists`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadListId: listId }),
        }),
      ),
    );
    setCompanies((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
  }

  async function deleteList() {
    setError(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/lead-lists/${listId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      router.push("/prospects/lists");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/prospects/lists" className="text-sm text-[var(--color-accent-text)] hover:underline">
        ← Lists
      </Link>

      <Card>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              List name
            </label>
            <div className="mt-2 flex gap-3">
              <Input aria-label="List name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button
                variant="secondary"
                onClick={rename}
                disabled={isRenaming || !name.trim() || name.trim() === savedName}
              >
                {isRenaming ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
          <Button variant="ghost" onClick={deleteList} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete List"}
          </Button>
        </div>
      </Card>

      <FormError message={error} />

      <div>
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
          <CountUp value={companies.length} suffix={companies.length === 1 ? " prospect" : " prospects"} />
        </h2>
      </div>

      {companies.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No prospects in this list yet. Add some from the search page or a prospect&apos;s page.
        </p>
      ) : (
        <>
          <FilterBar categories={categories} filters={filters} onChange={setFilters} />

          <BulkActionsBar
            selectedIds={Array.from(selectedIds)}
            onClearSelection={() => setSelectedIds(new Set())}
            onRemove={removeSelected}
            removeLabel="Remove from this list"
          />

          {filteredCompanies.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              No results match these filters.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCompanies.map((company) => (
                <Card key={company.id} className="animate-fade-in">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(company.id)}
                      onChange={() => toggleSelect(company.id)}
                      className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
                      aria-label={`Select ${company.name}`}
                    />
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{company.name}</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {company.category ?? "Uncategorized"}
                        {company.formattedAddress ? ` · ${company.formattedAddress}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ScoreBadge label="Fit" score={company.fitScore ?? 0} reason={company.fitReason} />
                    <ScoreBadge
                      label="Confidence"
                      score={company.confidenceScore ?? 0}
                      reason={company.confidenceReason}
                    />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/prospects/${company.id}`}
                      className="text-sm text-[var(--color-accent-text)] hover:underline"
                    >
                      View →
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => removeCompany(company.id)}
                      disabled={removingId === company.id}
                    >
                      {removingId === company.id ? "Removing…" : "Remove"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
