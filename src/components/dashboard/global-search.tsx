"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/app/api/search/route";

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();
    const t = setTimeout(() => {
      if (trimmed.length < 2) {
        setResults([]);
        return;
      }
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((body) => setResults(body.results ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative hidden w-64 sm:block">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search prospects, campaigns, tasks…"
        className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />

      {open && query.trim().length >= 2 && (
        <div className="glass-sheen absolute left-0 right-0 top-11 z-20 max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-glass-menu)] shadow-[var(--shadow-glass)] backdrop-blur-2xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">No matches.</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={`${r.type}-${r.label}-${r.href}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(r.href)}
                    className="flex w-full flex-col gap-0.5 px-4 py-2 text-left text-sm hover:bg-[var(--color-bg-secondary)]"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[var(--color-text-primary)]">{r.label}</span>
                      <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                        {r.type}
                      </span>
                    </span>
                    {r.sublabel && (
                      <span className="text-xs text-[var(--color-text-muted)]">{r.sublabel}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
