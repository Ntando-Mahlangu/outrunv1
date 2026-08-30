"use client";

import { useState } from "react";
import Link from "next/link";
import type { OutreachMessage, Company } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/form-error";

type MessageWithCompany = OutreachMessage & { company: Company };

const MIN_SENT_FOR_COMPARISON = 6;

export function CampaignSendPanel({
  campaignId,
  initialMessages,
  emailConfigured,
}: {
  campaignId: string;
  initialMessages: MessageWithCompany[];
  emailConfigured: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [generatingFollowUpsFor, setGeneratingFollowUpsFor] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<{
    sent: number;
    failed: number;
    skippedNoEmail: number;
    skippedNotDue?: number;
    skippedReplied?: number;
  } | null>(null);

  function isDue(message: MessageWithCompany) {
    return !message.scheduledFor || new Date(message.scheduledFor) <= new Date();
  }

  const topLevelMessages = messages.filter((m) => !m.followUpToId);
  const sendableCount = messages.filter(
    (m) => m.sendStatus !== "SENT" && m.company.contactEmail && isDue(m),
  ).length;
  const missingEmailCount = messages.filter((m) => !m.company.contactEmail).length;
  const hasVariants = topLevelMessages.some((m) => m.variantLabel);

  async function sendOne(messageId: string) {
    setError(null);
    setSendingId(messageId);
    try {
      const res = await fetch(`/api/outreach/${messageId}/send`, { method: "POST" });
      const body = await res.json();
      if (body.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, ...body.message } : m)),
        );
      }
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSendingId(null);
    }
  }

  async function sendAll() {
    setError(null);
    setIsSendingAll(true);
    setLastSummary(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setLastSummary(body);
      if (Array.isArray(body.messages)) setMessages(body.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSendingAll(false);
    }
  }

  async function generateFollowUps(messageId: string) {
    setError(null);
    setGeneratingFollowUpsFor(messageId);
    try {
      const res = await fetch(`/api/outreach/${messageId}/follow-ups`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMessages((prev) => [...prev, ...body.followUps.map((f: OutreachMessage) => ({
        ...f,
        company: prev.find((m) => m.id === messageId)!.company,
      }))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGeneratingFollowUpsFor(null);
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

  return (
    <>
      {hasVariants && <VariantComparison messages={messages} />}

      <Card interactive>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
            Outreach ({messages.length})
          </h2>
          <Button
            size="sm"
            onClick={sendAll}
            disabled={isSendingAll || !emailConfigured || sendableCount === 0}
          >
            {isSendingAll ? "Sending…" : `Send All (${sendableCount})`}
          </Button>
        </div>

        {!emailConfigured && (
          <p className="mt-2 text-xs text-[var(--color-warning)]">
            Email sending isn&apos;t configured for this workspace yet — messages can be reviewed
            and copied manually until it is.
          </p>
        )}
        {emailConfigured && missingEmailCount > 0 && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {missingEmailCount} prospect{missingEmailCount === 1 ? " has" : "s have"} no contact
            email yet — add one on their prospect page to include them in sending.
          </p>
        )}
        {lastSummary && (
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Sent {lastSummary.sent}, failed {lastSummary.failed}, skipped{" "}
            {lastSummary.skippedNoEmail} (no email on file)
            {typeof lastSummary.skippedNotDue === "number" &&
              `, ${lastSummary.skippedNotDue} (follow-up not due yet)`}
            {typeof lastSummary.skippedReplied === "number" &&
              `, ${lastSummary.skippedReplied} (prospect already replied)`}
            .
          </p>
        )}

        <div className="mt-4">
          <FormError message={error} />
        </div>

        <div className="mt-4 space-y-4">
          {topLevelMessages.map((message) => {
            const followUps = messages
              .filter((m) => m.followUpToId === message.id)
              .sort((a, b) => a.sequenceStep - b.sequenceStep);

            return (
              <div
                key={message.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/prospects/${message.companyId}`}
                      className="text-sm font-medium text-[var(--color-accent-text)] hover:underline"
                    >
                      {message.company.name}
                    </Link>
                    {message.variantLabel && (
                      <Badge tone="accent">Variant {message.variantLabel}</Badge>
                    )}
                  </div>
                  <SendStatusBadge
                    status={message.sendStatus}
                    sentAt={message.sentAt}
                    hasEmail={Boolean(message.company.contactEmail)}
                  />
                </div>
                <p className="mt-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  Subject
                </p>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {message.subject}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                  {message.body}
                </p>
                {message.linkedinMessage && (
                  <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                      LinkedIn Message
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                      {message.linkedinMessage}
                    </p>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => sendOne(message.id)}
                    disabled={
                      sendingId === message.id ||
                      message.sendStatus === "SENT" ||
                      !message.company.contactEmail ||
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
                  {message.sendStatus === "SENT" && followUps.length === 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => generateFollowUps(message.id)}
                      disabled={generatingFollowUpsFor === message.id}
                    >
                      {generatingFollowUpsFor === message.id
                        ? "Generating…"
                        : "Generate Follow-up Sequence"}
                    </Button>
                  )}
                </div>

                {followUps.length > 0 && (
                  <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-3">
                    {followUps.map((followUp) => (
                      <div
                        key={followUp.id}
                        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge tone="accent">Day {[3, 7, 14][followUp.sequenceStep - 1]}</Badge>
                            {followUp.scheduledFor && (
                              <span className="text-xs text-[var(--color-text-muted)]">
                                Scheduled {new Date(followUp.scheduledFor).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <SendStatusBadge
                            status={followUp.sendStatus}
                            sentAt={followUp.sentAt}
                            hasEmail={Boolean(message.company.contactEmail)}
                          />
                        </div>
                        <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">
                          {followUp.subject}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                          {followUp.body}
                        </p>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          Why this follow-up: {followUp.openingRationale}
                        </p>
                        {message.gotReply ? (
                          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                            Sequence stopped — prospect already replied.
                          </p>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-2"
                            onClick={() => sendOne(followUp.id)}
                            disabled={
                              sendingId === followUp.id ||
                              followUp.sendStatus === "SENT" ||
                              !message.company.contactEmail ||
                              !emailConfigured ||
                              !isDue(followUp)
                            }
                          >
                            {sendingId === followUp.id
                              ? "Sending…"
                              : followUp.sendStatus === "SENT"
                                ? "Sent"
                                : !isDue(followUp)
                                  ? "Not due yet"
                                  : followUp.sendStatus === "FAILED"
                                    ? "Retry Send"
                                    : "Send"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {topLevelMessages.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              No outreach was generated for this campaign.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}

function computeVariantStats(messages: MessageWithCompany[], label: "A" | "B") {
  const variantMessages = messages.filter((m) => m.variantLabel === label);
  const sent = variantMessages.filter((m) => m.sendStatus === "SENT");
  const replies = sent.filter((m) => m.gotReply).length;
  return {
    label,
    total: variantMessages.length,
    sent: sent.length,
    replies,
    replyRate: sent.length > 0 ? replies / sent.length : null,
  };
}

function VariantComparison({ messages }: { messages: MessageWithCompany[] }) {
  const a = computeVariantStats(messages, "A");
  const b = computeVariantStats(messages, "B");
  const variants = [a, b];

  const totalSent = a.sent + b.sent;
  const enoughData = totalSent >= MIN_SENT_FOR_COMPARISON;
  const leading =
    enoughData && a.replyRate !== null && b.replyRate !== null && a.replyRate !== b.replyRate
      ? (a.replyRate > b.replyRate ? a : b).label
      : null;

  return (
    <Card interactive>
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
        A/B Comparison
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Reply rate is based on messages you&apos;ve manually marked as replied — Outrun doesn&apos;t
        have inbox access, so this only reflects what you tell it.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {variants.map((v) => (
          <div
            key={v.label}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Variant {v.label}
              </p>
              {leading === v.label && <Badge tone="high">Leading</Badge>}
            </div>
            <p className="mt-2 text-2xl font-light text-[var(--color-text-primary)]">
              {v.replyRate !== null ? `${Math.round(v.replyRate * 100)}%` : "—"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {v.replies} repl{v.replies === 1 ? "y" : "ies"} out of {v.sent} sent ({v.total} total)
            </p>
          </div>
        ))}
      </div>

      {!enoughData && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Send at least {MIN_SENT_FOR_COMPARISON} messages across both variants before drawing
          conclusions — right now the sample is too small to mean much.
        </p>
      )}
    </Card>
  );
}

function SendStatusBadge({
  status,
  sentAt,
  hasEmail,
}: {
  status: string;
  sentAt: Date | string | null;
  hasEmail: boolean;
}) {
  if (status === "SENT") {
    return (
      <Badge tone="high">Sent{sentAt ? ` ${new Date(sentAt).toLocaleDateString()}` : ""}</Badge>
    );
  }
  if (status === "FAILED") {
    return <Badge tone="low">Failed to send</Badge>;
  }
  if (!hasEmail) {
    return <Badge tone="medium">No contact email</Badge>;
  }
  return null;
}
