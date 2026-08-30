"use client";

import { useState } from "react";
import type { OutreachMessage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/form-error";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function OutreachPanel({
  companyId,
  hasResearch,
  initialMessages,
  initialContactEmail,
  emailConfigured,
}: {
  companyId: string;
  hasResearch: boolean;
  initialMessages: OutreachMessage[];
  initialContactEmail: string | null;
  emailConfigured: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? "");
  const [savedContactEmail, setSavedContactEmail] = useState(initialContactEmail ?? "");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/prospects/${companyId}/outreach`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMessages((prev) => [body.message, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveContactEmail() {
    setError(null);
    setIsSavingEmail(true);
    try {
      const res = await fetch(`/api/prospects/${companyId}/contact-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contactEmail }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setSavedContactEmail(body.contactEmail ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function send(messageId: string) {
    setError(null);
    setSendingId(messageId);
    try {
      const res = await fetch(`/api/outreach/${messageId}/send`, { method: "POST" });
      const body = await res.json();
      // The route always includes current message state, even on failure,
      // since sendOutreachMessage marks FAILED in the DB before throwing.
      if (body.message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? body.message : m)));
      }
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSendingId(null);
    }
  }

  async function toggleReply(messageId: string, current: boolean) {
    setError(null);
    setReplyBusyId(messageId);
    try {
      const res = await fetch(`/api/outreach/${messageId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gotReply: !current }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...body.message } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setReplyBusyId(null);
    }
  }

  if (!hasResearch) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        Research this prospect first — outreach is written from the research
        profile so it stays specific to them.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />

      <div>
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">
          Contact email
        </label>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Outrun doesn&apos;t have a source for prospect emails yet — add one to send outreach.
        </p>
        <div className="mt-2 flex gap-3">
          <Input
            aria-label="Contact email"
            type="email"
            placeholder="owner@business.com"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={saveContactEmail}
            disabled={isSavingEmail || contactEmail === savedContactEmail}
          >
            {isSavingEmail ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {!emailConfigured && (
        <p className="text-xs text-[var(--color-warning)]">
          Email sending isn&apos;t configured for this workspace yet — messages can be generated
          and copied manually until it is.
        </p>
      )}

      <Button onClick={generate} disabled={isGenerating}>
        {isGenerating ? "Writing…" : messages.length ? "Generate Another Version" : "Generate Outreach"}
      </Button>

      <div className="space-y-4">
        {messages.map((message) => (
          <Card key={message.id} interactive className="bg-[var(--color-bg-secondary)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  Subject
                </p>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {message.subject}
                </p>
              </div>
              <SendStatusBadge status={message.sendStatus} sentAt={message.sentAt} />
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
              {message.body}
            </p>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              Why this opener: {message.openingRationale}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => send(message.id)}
                disabled={
                  sendingId === message.id ||
                  message.sendStatus === "SENT" ||
                  !savedContactEmail ||
                  !emailConfigured
                }
              >
                {sendingId === message.id
                  ? "Sending…"
                  : message.sendStatus === "SENT"
                    ? "Sent"
                    : message.sendStatus === "FAILED"
                      ? "Retry Send"
                      : "Send"}
              </Button>
              {message.sendStatus === "SENT" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleReply(message.id, message.gotReply)}
                  disabled={replyBusyId === message.id}
                >
                  {message.gotReply ? "✓ Marked as replied" : "Mark as replied"}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SendStatusBadge({ status, sentAt }: { status: string; sentAt: Date | null }) {
  if (status === "SENT") {
    return (
      <Badge tone="high">
        Sent{sentAt ? ` ${new Date(sentAt).toLocaleDateString()}` : ""}
      </Badge>
    );
  }
  if (status === "FAILED") {
    return <Badge tone="low">Failed to send</Badge>;
  }
  return null;
}
