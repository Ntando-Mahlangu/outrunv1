"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { cn } from "@/lib/cn";

type Message = { role: "USER" | "ASSISTANT"; content: string };

// autoAsk carries a question in from Global Search (docs/outrun/04
// "GLOBAL SEARCH" — question/command-shaped queries route here rather
// than a useless name lookup). Sent exactly once per mount, guarded by
// autoAskedRef so React's dev-mode double-invoke and any re-render don't
// fire it twice, then the ?ask= param is stripped from the URL so a
// refresh or back-navigation doesn't resend the same question.
export function ChatPanel({
  initialMessages,
  autoAsk,
}: {
  initialMessages: Message[];
  autoAsk?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const autoAskedRef = useRef(false);

  async function send(question: string) {
    setError(null);
    setMessages((prev) => [...prev, { role: "USER", content: question }]);
    setIsSending(true);

    try {
      const res = await fetch("/api/growth-partner/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMessages((prev) => [...prev, { role: "ASSISTANT", content: body.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSending(false);
    }
  }

  useEffect(() => {
    if (!autoAsk || autoAskedRef.current) return;
    autoAskedRef.current = true;
    router.replace("/growth-partner");
    void send(autoAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    setInput("");
    await send(question);
  }

  return (
    <Card className="flex h-[32rem] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Ask anything — &quot;How should I grow next month?&quot;,
            &quot;Why should I focus on this opportunity?&quot;,
            &quot;What&apos;s my biggest weakness?&quot;
          </p>
        )}
        {messages.map((message, i) => (
          <div
            key={i}
            className={cn("max-w-[85%] rounded-[var(--radius-md)] px-4 py-3 text-sm", {
              "ml-auto bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]":
                message.role === "USER",
              "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]":
                message.role === "ASSISTANT",
            })}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
        {isSending && (
          <div className="max-w-[85%] rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            Thinking…
          </div>
        )}
      </div>

      <FormError message={error} />

      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <Input
          aria-label="Message to your Growth Partner"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your Growth Partner…"
          disabled={isSending}
        />
        <Button type="submit" disabled={isSending || !input.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}
