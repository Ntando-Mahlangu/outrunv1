import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/motion/reveal";
import { SacredGeometry } from "@/components/motion/backgrounds";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <SacredGeometry />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center">
        <SplitHeading
          text="Ready to Stop Guessing?"
          className="text-3xl font-light tracking-tight text-[var(--color-text-primary)] sm:text-4xl"
        />
        <Reveal delay={0.1}>
          <p className="mt-4 text-[var(--color-text-secondary)]">
            Let Outrun build your first Growth Blueprint today.
          </p>
          <div className="mt-8">
            <Magnetic className="inline-block">
              <Link
                href="/sign-up"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "shadow-[var(--shadow-glow)] transition-shadow duration-300 hover:shadow-[var(--shadow-glow-lg)]",
                )}
              >
                Start Now
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
