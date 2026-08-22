"use client";

import { useState } from "react";
import type { CallLog, CallOutcome, Contact } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-error";
import { formatDate } from "@/lib/i18n/format";
import { readJsonSafely } from "@/lib/fetch-json";

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  ANSWERED: "Answered",
  VOICEMAIL: "Voicemail",
  NO_ANSWER: "No answer",
  CALLBACK_REQUESTED: "Callback requested",
  NOT_INTERESTED: "Not interested",
  WRONG_NUMBER: "Wrong number",
  DO_NOT_CALL: "Do not call",
};

const OUTCOME_OPTIONS = Object.keys(OUTCOME_LABEL) as CallOutcome[];

export function CallLogPanel({
  companyId,
  contacts,
  initialCallLogs,
}: {
  companyId: string;
  contacts: Contact[];
  initialCallLogs: CallLog[];
}) {
  const [callLogs, setCallLogs] = useState(initialCallLogs);
  const [contactId, setContactId] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome>("ANSWERED");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLogging(true);

    try {
      const res = await fetch(`/api/prospects/${companyId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contactId || null, outcome, notes }),
      });
      const body = await readJsonSafely(res);
      if (!res.ok) throw new Error((body?.error as string) ?? "We couldn't log that call.");

      setCallLogs((prev) => [body!.callLog as CallLog, ...prev]);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't log that call.");
    } finally {
      setIsLogging(false);
    }
  }

  async function handleDelete(callId: string) {
    setError(null);
    setBusyId(callId);
    try {
      const res = await fetch(`/api/prospects/${companyId}/calls/${callId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await readJsonSafely(res);
        throw new Error((body?.error as string) ?? "We couldn't remove that call log.");
      }
      setCallLogs((prev) => prev.filter((c) => c.id !== callId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't remove that call log.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {callLogs.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No calls logged yet — record the outcome after your next call below.
        </p>
      ) : (
        <ul className="space-y-3">
          {callLogs.map((log) => {
            const contact = contacts.find((c) => c.id === log.contactId);
            return (
              <li
                key={log.id}
                className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {OUTCOME_LABEL[log.outcome]}
                    {contact && (
                      <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                        with {contact.name}
                      </span>
                    )}
                  </p>
                  {log.notes && (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{log.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {log.loggedByName} · {formatDate(log.createdAt)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="h-8 shrink-0 px-3 text-xs"
                  disabled={busyId === log.id}
                  onClick={() => handleDelete(log.id)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleLog} className="space-y-3 border-t border-[var(--color-border)] pt-4">
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Select
            aria-label="Call outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as CallOutcome)}
          >
            {OUTCOME_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {OUTCOME_LABEL[value]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Contact spoken to (optional)"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">No specific contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Input
          aria-label="Notes"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button type="submit" variant="secondary" className="h-9 px-4 text-sm" disabled={isLogging}>
          {isLogging ? "Logging…" : "Log call"}
        </Button>
      </form>
    </div>
  );
}
