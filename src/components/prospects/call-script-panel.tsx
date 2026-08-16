"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import type { CallScriptData } from "@/lib/prospects/call-script-schema";

export function CallScriptPanel({
  companyId,
  companyPhone,
  hasResearch,
  initialCallScript,
}: {
  companyId: string;
  companyPhone: string | null;
  hasResearch: boolean;
  initialCallScript: CallScriptData | null;
}) {
  const [script, setScript] = useState(initialCallScript);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function generate() {
    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/prospects/${companyId}/call-script`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setScript(body.company.callScript as CallScriptData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }

  const phoneNote = companyPhone ? (
    <p className="text-sm text-[var(--color-text-secondary)]">
      Number to dial:{" "}
      <a href={`tel:${companyPhone}`} className="text-[var(--color-accent-text)] hover:underline">
        {companyPhone}
      </a>
    </p>
  ) : (
    <p className="text-sm text-[var(--color-text-muted)]">
      No phone number on file for this company — add one in Contacts above if you have it.
    </p>
  );

  if (!hasResearch) {
    return (
      <div className="space-y-3">
        {phoneNote}
        <p className="text-sm text-[var(--color-text-muted)]">
          Research this prospect first — the call script is written from the research
          profile so it stays specific to them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phoneNote}
      <FormError message={error} />

      <Button onClick={generate} disabled={isGenerating}>
        {isGenerating ? "Writing…" : script ? "Regenerate Call Script" : "Generate Call Script"}
      </Button>

      {script && (
        <div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <ScriptSection title="Opening">{script.opening}</ScriptSection>
          <ScriptSection title="Discovery Questions">
            <ul className="list-disc space-y-1 pl-4">
              {script.discoveryQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </ScriptSection>
          <ScriptSection title="Pain Exploration">{script.painExploration}</ScriptSection>
          <ScriptSection title="Value Statement">{script.valueStatement}</ScriptSection>
          <ScriptSection title="Objection Handling">
            <div className="space-y-2">
              {script.objectionHandling.map((o, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    &ldquo;{o.objection}&rdquo;
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{o.response}</p>
                </div>
              ))}
            </div>
          </ScriptSection>
          <ScriptSection title="Closing">{script.closing}</ScriptSection>
        </div>
      )}
    </div>
  );
}

function ScriptSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{title}</p>
      <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{children}</div>
    </div>
  );
}
