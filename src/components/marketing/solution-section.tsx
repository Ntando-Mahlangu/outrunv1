import { Card } from "@/components/ui/card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { SacredGeometry } from "@/components/motion/backgrounds";
import { SplitHeading } from "@/components/motion/split-heading";

const CAPABILITIES = [
  "Learns your business.",
  "Builds a growth strategy.",
  "Finds opportunities.",
  "Researches prospects.",
  "Creates outreach.",
  "Prepares campaigns.",
  "Tracks progress.",
  "Recommends your next move.",
];

export function SolutionSection() {
  return (
    <section className="relative overflow-hidden py-20">
      <SacredGeometry />
      <div className="relative z-10 mx-auto max-w-5xl px-6">
        <SplitHeading
          text="Meet Your AI Growth Partner"
          className="text-center text-3xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <Reveal>
          <p className="mx-auto mt-4 max-w-xl text-center text-[var(--color-text-secondary)]">
            Instead of another dashboard, you get a partner that does the work with
            you — not just software that reports what already happened.
          </p>
        </Reveal>
        <RevealGroup className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
          {CAPABILITIES.map((capability) => (
            <RevealItem key={capability}>
              <Card interactive className="p-5 text-center">
                <p className="text-sm text-[var(--color-text-primary)]">{capability}</p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
