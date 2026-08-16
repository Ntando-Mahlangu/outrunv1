import { Reveal } from "@/components/motion/reveal";
import { LiquidMesh } from "@/components/motion/backgrounds";
import { SplitHeading } from "@/components/motion/split-heading";

export function ProductPhilosophy() {
  return (
    <section className="relative overflow-hidden py-20 text-center">
      <LiquidMesh />
      <div className="relative z-10 mx-auto max-w-2xl px-6">
        <SplitHeading
          text={"Software should think.\nNot make you think."}
          className="text-3xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <Reveal delay={0.1}>
          <p className="mx-auto mt-4 max-w-md text-[var(--color-text-secondary)]">
            Outrun removes busy work so business owners can focus on making
            decisions.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
