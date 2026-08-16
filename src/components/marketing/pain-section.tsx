import { Card } from "@/components/ui/card";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { GenerativeLattice } from "@/components/motion/backgrounds";
import { SplitHeading } from "@/components/motion/split-heading";

const PAINS = [
  "Finding leads takes too long.",
  "You don't know where to focus.",
  "Marketing feels random.",
  "Your spreadsheets tell you what happened — not what to do next.",
];

export function PainSection() {
  return (
    <section className="relative overflow-hidden py-20">
      <GenerativeLattice />
      <div className="relative z-10 mx-auto max-w-5xl px-6">
        <SplitHeading
          text="Growing a business shouldn't feel like guesswork."
          className="text-center text-3xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2" stagger={0.1}>
          {PAINS.map((pain) => (
            <RevealItem key={pain}>
              <Card interactive className="text-[var(--color-text-secondary)]">
                {pain}
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
        <Reveal delay={0.15}>
          <p className="mt-8 text-center text-lg text-[var(--color-text-primary)]">
            Outrun changes that.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
