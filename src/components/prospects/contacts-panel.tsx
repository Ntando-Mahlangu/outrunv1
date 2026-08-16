"use client";

import { useState } from "react";
import type { Contact, ContactRelationshipStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormError } from "@/components/ui/form-error";
import { readJsonSafely } from "@/lib/fetch-json";

const RELATIONSHIP_STATUS_LABEL: Record<ContactRelationshipStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  RESPONDED: "Responded",
  QUALIFIED: "Qualified",
  CUSTOMER: "Customer",
  LOST: "Lost",
};

const RELATIONSHIP_STATUS_OPTIONS = Object.keys(
  RELATIONSHIP_STATUS_LABEL,
) as ContactRelationshipStatus[];

export function ContactsPanel({
  companyId,
  initialContacts,
}: {
  companyId: string;
  initialContacts: Contact[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsAdding(true);

    try {
      const res = await fetch(`/api/prospects/${companyId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, email, phone }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't add that contact.");

      setContacts((prev) => [...prev, body!.contact as Contact]);
      setName("");
      setRole("");
      setEmail("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't add that contact.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(contactId: string) {
    setError(null);
    setBusyId(contactId);
    try {
      const res = await fetch(`/api/prospects/${companyId}/contacts/${contactId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await readJsonSafely(res);
        throw new Error((body?.error as string) ?? "We couldn't remove that contact.");
      }
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't remove that contact.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatusChange(contactId: string, relationshipStatus: ContactRelationshipStatus) {
    setBusyId(contactId);
    setError(null);
    try {
      const res = await fetch(`/api/prospects/${companyId}/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipStatus }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't update that contact.");
      setContacts((prev) => prev.map((c) => (c.id === contactId ? (body!.contact as Contact) : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't update that contact.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {contacts.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No contacts yet — add the people you actually talk to at this company below.
        </p>
      ) : (
        <ul className="space-y-3">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {contact.name}
                  {contact.role && (
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">{contact.role}</span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {[contact.email, contact.phone].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Select
                  aria-label={`Relationship status for ${contact.name}`}
                  className="h-8 w-36 px-2 text-xs"
                  value={contact.relationshipStatus}
                  disabled={busyId === contact.id}
                  onChange={(e) =>
                    handleStatusChange(contact.id, e.target.value as ContactRelationshipStatus)
                  }
                >
                  {RELATIONSHIP_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {RELATIONSHIP_STATUS_LABEL[status]}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  disabled={busyId === contact.id}
                  onClick={() => handleDelete(contact.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="space-y-3 border-t border-[var(--color-border)] pt-4">
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Input
            aria-label="Name"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            aria-label="Role"
            placeholder="Role (optional)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <Input
            aria-label="Email"
            placeholder="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            aria-label="Phone"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" className="h-9 px-4 text-sm" disabled={isAdding}>
          {isAdding ? "Adding…" : "Add contact"}
        </Button>
      </form>
    </div>
  );
}
