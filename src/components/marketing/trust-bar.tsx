import { Reveal } from "@/components/motion/reveal";
import { ConcentricRings } from "@/components/motion/backgrounds";

// docs/outrun/02 "TRUST BAR" — "Future company logos can be added later.
// Until then use tasteful placeholders. Never use fake testimonials. Never
// invent customer logos." These are abstract geometric marks, deliberately
// not company names, so nothing here could be mistaken for a real or
// invented customer.
const PLACEHOLDER_MARKS = ["◆", "▲", "●", "■", "◈"];

export function TrustBar() {
  return (
    <section className="relative overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40 py-10">
      <ConcentricRings />
      <Reveal className="relative z-10 mx-auto max-w-5xl px-6">
        <p className="text-center text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          Trusted by ambitious businesses worldwide
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-40">
          {PLACEHOLDER_MARKS.map((mark, i) => (
            <span
              key={i}
              aria-hidden
              className="text-2xl text-[var(--color-text-muted)]"
            >
              {mark}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
