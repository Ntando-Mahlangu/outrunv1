"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/form-error";
import { formatDate } from "@/lib/i18n/format";
import { readJsonSafely } from "@/lib/fetch-json";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

// docs/outrun/14 "API Access (Limited)" — Growth plan and above
// (src/lib/billing/feature-flags.ts's API_ACCESS flag). Below that tier
// this renders an upgrade prompt instead of the key-management form; the
// server enforces the same gate independently (src/lib/api-keys/service.ts)
// so this UI check is a convenience, not the real boundary.
export function ApiKeysSection({
  canManage,
  isEnabled,
  initialKeys,
}: {
  canManage: boolean;
  isEnabled: boolean;
  initialKeys: ApiKeyRow[];
}) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  if (!isEnabled) {
    return (
      <Card>
        <h2 className="mb-1 text-lg font-medium text-[var(--color-text-primary)]">API Access</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Programmatic access to your prospects data is available on the Growth plan and
          above.{" "}
          <a href="/billing" className="underline">
            Upgrade to enable API keys
          </a>
          .
        </p>
      </Card>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const res = await fetch("/api/team/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't create that API key.");

      const key = (body as { key: ApiKeyRow & { rawKey: string } }).key;
      setRevealedKey(key.rawKey);
      setKeys((prev) => [
        {
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          createdAt: key.createdAt,
          lastUsedAt: null,
          revokedAt: null,
        },
        ...prev,
      ]);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't create that API key.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    setRevokingId(id);
    try {
      const res = await fetch(`/api/team/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await readJsonSafely(res);
        throw new Error((body?.error as string) ?? "We couldn't revoke that key.");
      }
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't revoke that key.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-medium text-[var(--color-text-primary)]">API Access</h2>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Read-only access to your prospects data for external tools. Pass a key as{" "}
        <code className="rounded bg-[var(--color-bg-secondary)] px-1 py-0.5 text-xs">
          Authorization: Bearer &lt;key&gt;
        </code>{" "}
        to <code className="rounded bg-[var(--color-bg-secondary)] px-1 py-0.5 text-xs">
          GET /api/v1/public/prospects
        </code>
        .
      </p>

      {revealedKey && (
        <div className="mb-4 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-bg-secondary)] p-3">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Copy this key now — it won&apos;t be shown again.
          </p>
          <code className="block break-all rounded bg-[var(--color-bg-primary)] p-2 text-xs">
            {revealedKey}
          </code>
          <Button type="button" onClick={() => setRevealedKey(null)}>
            I&apos;ve saved it
          </Button>
        </div>
      )}

      {canManage && !revealedKey && (
        <form onSubmit={handleCreate} className="mb-6 flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="api-key-name">Key name</Label>
            <Input
              id="api-key-name"
              placeholder="e.g. Zapier integration"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isCreating || !name.trim()}>
            {isCreating ? "Creating…" : "Generate key"}
          </Button>
        </form>
      )}
      <FormError message={error} />

      {keys.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {canManage
            ? "No API keys yet — generate one above to start pulling your prospects data into another tool."
            : "No API keys yet. Ask a workspace admin to generate one."}
        </p>
      ) : (
        <ul className="space-y-3">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3 text-sm last:border-0 last:pb-0"
            >
              <div>
                <p className="text-[var(--color-text-primary)]">
                  {key.name}{" "}
                  <span className="text-xs text-[var(--color-text-muted)]">{key.keyPrefix}…</span>
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Created {formatDate(new Date(key.createdAt))}
                  {key.lastUsedAt ? ` · Last used ${formatDate(new Date(key.lastUsedAt))}` : " · Never used"}
                </p>
              </div>
              {key.revokedAt ? (
                <Badge tone="medium">Revoked</Badge>
              ) : canManage ? (
                <Button
                  type="button"
                  onClick={() => handleRevoke(key.id)}
                  disabled={revokingId === key.id}
                  className="border border-[var(--color-error)] bg-transparent text-[var(--color-error-text)] hover:bg-[var(--color-error)]/10"
                >
                  {revokingId === key.id ? "Revoking…" : "Revoke"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
