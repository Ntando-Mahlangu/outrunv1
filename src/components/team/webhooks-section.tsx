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

type WebhookEndpointRow = {
  id: string;
  url: string;
  enabled: boolean;
  createdAt: string;
};

// docs/outrun/11 "WEBHOOK SYSTEM" — lets a customer receive every
// business event Outrun logs (Campaign Created, Growth Blueprint
// Updated, ...) at their own URL, e.g. Zapier's "Webhooks" trigger.
export function WebhooksSection({
  canManage,
  initialEndpoints,
}: {
  canManage: boolean;
  initialEndpoints: WebhookEndpointRow[];
}) {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const res = await fetch("/api/team/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't add that webhook.");

      const endpoint = (body as { endpoint: WebhookEndpointRow & { rawSecret: string } }).endpoint;
      setRevealedSecret(endpoint.rawSecret);
      setEndpoints((prev) => [
        { id: endpoint.id, url: endpoint.url, enabled: true, createdAt: endpoint.createdAt },
        ...prev,
      ]);
      setUrl("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't add that webhook.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    setRemovingId(id);
    try {
      const res = await fetch(`/api/team/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await readJsonSafely(res);
        throw new Error((body?.error as string) ?? "We couldn't remove that endpoint.");
      }
      setEndpoints((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't remove that endpoint.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleToggle(id: string, nextEnabled: boolean) {
    setError(null);
    setTogglingId(id);
    try {
      const res = await fetch(`/api/team/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        const body = await readJsonSafely(res);
        throw new Error((body?.error as string) ?? "We couldn't update that endpoint.");
      }
      setEndpoints((prev) => prev.map((e) => (e.id === id ? { ...e, enabled: nextEnabled } : e)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't update that endpoint.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-medium text-[var(--color-text-primary)]">Webhooks</h2>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Send a signed HTTP POST to your own URL whenever something happens in Outrun —
        a campaign finishes, a Growth Blueprint updates, a goal is completed. Verify each
        request with the{" "}
        <code className="rounded bg-[var(--color-bg-secondary)] px-1 py-0.5 text-xs">
          X-Outrun-Signature
        </code>{" "}
        header (HMAC-SHA256 of the raw body, using the secret shown once below).
      </p>

      {revealedSecret && (
        <div className="mb-4 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-accent)]/40 bg-[var(--color-bg-secondary)] p-3">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Copy this signing secret now — it won&apos;t be shown again.
          </p>
          <code className="block break-all rounded bg-[var(--color-bg-primary)] p-2 text-xs">
            {revealedSecret}
          </code>
          <Button type="button" onClick={() => setRevealedSecret(null)}>
            I&apos;ve saved it
          </Button>
        </div>
      )}

      {canManage && !revealedSecret && (
        <form onSubmit={handleCreate} className="mb-6 flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://hooks.zapier.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isCreating || !url.trim()}>
            {isCreating ? "Adding…" : "Add endpoint"}
          </Button>
        </form>
      )}
      <FormError message={error} />

      {endpoints.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {canManage
            ? "No webhook endpoints yet — add one above to have your own tools react to what happens in Outrun."
            : "No webhook endpoints yet. Ask a workspace admin to add one."}
        </p>
      ) : (
        <ul className="space-y-3">
          {endpoints.map((endpoint) => (
            <li
              key={endpoint.id}
              className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3 text-sm last:border-0 last:pb-0"
            >
              <div>
                <p className="break-all text-[var(--color-text-primary)]">
                  {endpoint.url} {!endpoint.enabled && <Badge tone="medium">Paused</Badge>}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Added {formatDate(new Date(endpoint.createdAt))}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    onClick={() => handleToggle(endpoint.id, !endpoint.enabled)}
                    disabled={togglingId === endpoint.id}
                    className="border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                  >
                    {togglingId === endpoint.id
                      ? "Updating…"
                      : endpoint.enabled
                        ? "Pause"
                        : "Re-enable"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleRemove(endpoint.id)}
                    disabled={removingId === endpoint.id}
                    className="border border-[var(--color-error)] bg-transparent text-[var(--color-error-text)] hover:bg-[var(--color-error)]/10"
                  >
                    {removingId === endpoint.id ? "Removing…" : "Remove"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
