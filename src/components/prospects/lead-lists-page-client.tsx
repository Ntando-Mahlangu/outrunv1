"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-error";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";

type LeadListSummary = { id: string; name: string; companyCount: number; createdAt: Date };

export function LeadListsPageClient({ initialLists }: { initialLists: LeadListSummary[] }) {
  const [lists, setLists] = useState(initialLists);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const res = await fetch("/api/lead-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setLists((prev) => [...prev, { ...body.list, companyCount: 0 }]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteList(id: string) {
    setError(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/lead-lists/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setLists((prev) => prev.filter((l) => l.id !== id));
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
            text="Lead Lists"
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Organize saved prospects into lists like &ldquo;Hot Prospects&rdquo; or &ldquo;Q3
            Campaign&rdquo;.
          </p>
        </div>
        <Link href="/prospects" className="mt-1 text-sm text-[var(--color-accent-text)] hover:underline">
          ← Find Prospects
        </Link>
      </div>

      <Card>
        <form onSubmit={createList} className="flex gap-3">
          <Input
            aria-label="List name"
            placeholder="e.g. Hot Prospects"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Magnetic strength={0.15} className="inline-block">
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? "Creating…" : "Create List"}
            </Button>
          </Magnetic>
        </form>
      </Card>

      <FormError message={error} />

      {lists.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          You don&apos;t have any lists yet. Create one above, then add prospects to it from
          their search result or prospect page.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Card key={list.id} className="animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{list.name}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {list.companyCount} prospect{list.companyCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Link
                  href={`/prospects/lists/${list.id}`}
                  className="text-sm text-[var(--color-accent-text)] hover:underline"
                >
                  View →
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => deleteList(list.id)}
                  disabled={deletingId === list.id}
                >
                  {deletingId === list.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
