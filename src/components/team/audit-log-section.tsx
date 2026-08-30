import type { AuditAction } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/i18n/format";

type AuditLogEntry = {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  targetType: string | null;
  createdAt: Date;
  metadata: unknown;
};

const ACTION_LABEL: Record<AuditAction, string> = {
  ROLE_CHANGED: "Role changed",
  MEMBER_REMOVED: "Member removed",
  MEMBER_INVITED: "Member invited",
  BILLING_CHANGED: "Billing changed",
  DATA_EXPORTED: "Data exported",
  LOGIN: "Signed in",
  LOGIN_FAILED: "Failed sign-in",
  WORKSPACE_DELETED: "Workspace deleted",
  API_KEY_CREATED: "API key created",
  API_KEY_REVOKED: "API key revoked",
  WEBHOOK_ENDPOINT_CREATED: "Webhook added",
  WEBHOOK_ENDPOINT_DELETED: "Webhook removed",
  WEBHOOK_ENDPOINT_ENABLED: "Webhook re-enabled",
  WEBHOOK_ENDPOINT_DISABLED: "Webhook paused",
};

function describe(entry: AuditLogEntry, actorNames: Map<string, string>): string {
  const actor = entry.actorUserId ? (actorNames.get(entry.actorUserId) ?? "A team member") : "Outrun";
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;

  switch (entry.action) {
    case "ROLE_CHANGED":
      return `${actor} changed a member's role from ${meta.fromRole} to ${meta.toRole}`;
    case "MEMBER_REMOVED":
      return `${actor} removed a team member`;
    case "MEMBER_INVITED":
      return `${actor} invited ${meta.email ?? "someone"} as ${meta.role ?? "a member"}`;
    case "BILLING_CHANGED":
      return `Plan changed from ${meta.fromTier} to ${meta.toTier}`;
    case "DATA_EXPORTED":
      return `${actor} exported ${(entry.targetType ?? "data").replace(/_/g, " ")}${meta.format ? ` as ${meta.format}` : ""}`;
    case "LOGIN":
      return `${actor} signed in`;
    case "LOGIN_FAILED":
      return `Failed sign-in attempt for ${actor}`;
    case "WORKSPACE_DELETED":
      return `${actor} deleted this workspace`;
    case "API_KEY_CREATED":
      return `${actor} created API key "${meta.name ?? "unnamed"}"`;
    case "API_KEY_REVOKED":
      return `${actor} revoked API key "${meta.name ?? "unnamed"}"`;
    case "WEBHOOK_ENDPOINT_CREATED":
      return `${actor} added a webhook for ${meta.url ?? "an endpoint"}`;
    case "WEBHOOK_ENDPOINT_DELETED":
      return `${actor} removed the webhook for ${meta.url ?? "an endpoint"}`;
    case "WEBHOOK_ENDPOINT_ENABLED":
      return `${actor} re-enabled the webhook for ${meta.url ?? "an endpoint"}`;
    case "WEBHOOK_ENDPOINT_DISABLED":
      return `${actor} paused the webhook for ${meta.url ?? "an endpoint"}`;
  }
}

export function AuditLogSection({
  entries,
  actorNames,
}: {
  entries: AuditLogEntry[];
  actorNames: Map<string, string>;
}) {
  return (
    <Card interactive>
      <h2 className="mb-1 text-lg font-medium text-[var(--color-text-primary)]">Audit Log</h2>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Every role change, removal, billing change, invite, and data export in this workspace.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No administrative activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3 text-sm last:border-0 last:pb-0"
            >
              <div>
                <p className="text-[var(--color-text-primary)]">{describe(entry, actorNames)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{ACTION_LABEL[entry.action]}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                {formatDate(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
