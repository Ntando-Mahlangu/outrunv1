"use client";

import { useMemo, useState } from "react";
import type { Company } from "@prisma/client";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { CompanyCard } from "@/components/prospects/company-card";
import {
  FilterBar,
  DEFAULT_PROSPECT_FILTERS,
  applyProspectFilters,
  type ProspectFilters,
} from "@/components/prospects/filter-bar";
import { BulkActionsBar } from "@/components/prospects/bulk-actions-bar";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";

type Interpretation = { searchedFor: string; unsupportedIntents: string[] };

export default function ProspectsPage() {
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<ProspectFilters>(DEFAULT_PROSPECT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categories = useMemo(
    () =>
      Array.from(new Set((companies ?? []).map((c) => c.category).filter((c): c is string => Boolean(c)))).sort(),
    [companies],
  );

  const filteredCompanies = useMemo(
    () => (companies ? applyProspectFilters(companies, filters) : null),
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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSearching(true);
    setSelectedIds(new Set());

    try {
      const res = await fetch("/api/prospects/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setCompanies(body.companies);
      setInterpretation(body.interpretation ?? null);
      setFilters(DEFAULT_PROSPECT_FILTERS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SplitHeading
            as="h1"
            text="Find Prospects"
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Describe who you&apos;re looking for in plain English.
          </p>
        </div>
        <Link
          href="/prospects/lists"
          className="mt-1 text-sm text-[var(--color-accent-text)] hover:underline"
        >
          Your Lists →
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <Input
          aria-label="Search for prospects"
          placeholder="e.g. accounting firms in Chicago"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Magnetic strength={0.15} className="inline-block">
          <Button type="submit" disabled={isSearching}>
            {isSearching ? "Searching…" : "Search"}
          </Button>
        </Magnetic>
      </form>

      <FormError message={error} />

      {interpretation && companies !== null && (
        <div className="text-sm text-[var(--color-text-secondary)]">
          <p>
            Searching for:{" "}
            <span className="text-[var(--color-text-primary)]">
              {interpretation.searchedFor}
            </span>
          </p>
          {interpretation.unsupportedIntents.length > 0 && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Outrun can&apos;t yet verify: {interpretation.unsupportedIntents.join(", ")} —
              showing best-fit matches by what it can confirm.
            </p>
          )}
        </div>
      )}

      {companies === null && !error && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Your search results will appear here, ranked by Fit Score.
        </p>
      )}

      {companies !== null && companies.length === 0 && !error && (
        <p className="text-sm text-[var(--color-text-muted)]">
          No matching businesses found. Try a broader description or a different
          location.
        </p>
      )}

      {companies && companies.length > 0 && (
        <>
          <FilterBar categories={categories} filters={filters} onChange={setFilters} />

          <BulkActionsBar
            selectedIds={Array.from(selectedIds)}
            onClearSelection={() => setSelectedIds(new Set())}
          />

          {filteredCompanies && filteredCompanies.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              No results match these filters.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCompanies?.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  selected={selectedIds.has(company.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
