"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LeadListSummary = { id: string; name: string; companyCount: number };

export function AddToListMenu({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState<LeadListSummary[] | null>(null);
  const [memberListIds, setMemberListIds] = useState<Set<string>>(new Set());
  const [busyListId, setBusyListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function openMenu() {
    setOpen(true);
    if (lists) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/prospects/${companyId}/lists`);
      const body = await res.json();
      if (res.ok) {
        setLists(body.lists);
        setMemberListIds(new Set(body.memberListIds));
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleList(listId: string, isMember: boolean) {
    setError(null);
    setBusyListId(listId);
    try {
      const res = await fetch(`/api/prospects/${companyId}/lists`, {
        method: isMember ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadListId: listId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMemberListIds((prev) => {
        const next = new Set(prev);
        if (isMember) next.delete(listId);
        else next.add(listId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyListId(null);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const createRes = await fetch("/api/lead-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName }),
      });
      const createBody = await createRes.json();
      if (!createRes.ok) throw new Error(createBody.error ?? "Something went wrong.");

      await toggleList(createBody.list.id, false);
      setLists((prev) => [
        ...(prev ?? []),
        { id: createBody.list.id, name: createBody.list.name, companyCount: 1 },
      ]);
      setNewListName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button type="button" variant="ghost" size="sm" onClick={() => (open ? setOpen(false) : openMenu())}>
        Add to list
      </Button>

      {open && (
        <div className="glass-sheen absolute right-0 z-20 mt-2 w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-glass-menu)] p-3 shadow-[var(--shadow-glass)] backdrop-blur-2xl">
          {error && <p className="mb-2 text-xs text-[var(--color-error-text)]">{error}</p>}

          {loading && <p className="text-xs text-[var(--color-text-muted)]">Loading lists…</p>}

          {!loading && lists && lists.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">No lists yet — create one below.</p>
          )}

          {!loading && lists && lists.length > 0 && (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {lists.map((list) => {
                const isMember = memberListIds.has(list.id);
                return (
                  <label
                    key={list.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-card)]"
                  >
                    <input
                      type="checkbox"
                      checked={isMember}
                      disabled={busyListId === list.id}
                      onChange={() => toggleList(list.id, isMember)}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    {list.name}
                  </label>
                );
              })}
            </div>
          )}

          <form onSubmit={createAndAdd} className="mt-3 flex gap-2">
            <Input
              aria-label="New list name"
              placeholder="New list name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="text-sm"
            />
            <Button type="submit" size="sm" disabled={isCreating || !newListName.trim()}>
              {isCreating ? "Adding…" : "Add"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
