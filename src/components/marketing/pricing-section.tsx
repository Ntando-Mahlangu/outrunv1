import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PLANS } from "@/lib/billing/plans";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ConcentricRings } from "@/components/motion/backgrounds";
import { SplitHeading } from "@/components/motion/split-heading";
import { CountUp } from "@/components/motion/count-up";
import { Magnetic } from "@/components/motion/magnetic";

// docs/outrun/02 puts "Most Popular" on Growth and a display badge on
// Unlimited — a purely cosmetic marketing distinction, independent of
// which tiers actually have a configured Paddle price (Billing page
// renders a real checkout button for any tier whose price ID resolves).
const MARKETING_BADGE: Partial<Record<keyof typeof PLANS, string>> = {
  GROWTH: "Most Popular",
  UNLIMITED: "Best for businesses serious about growth",
};

const TIER_ORDER: (keyof typeof PLANS)[] = ["FREE", "STARTER", "GROWTH", "UNLIMITED"];

// plan.priceLabel is a formatted string like "$49/month" or "$0" — split
// into the numeric part so it can count up, keeping "$"/"/month" as
// static prefix/suffix around it.
function splitPriceLabel(label: string): { amount: number; suffix: string } {
  const match = /^\$(\d+)(.*)$/.exec(label);
  if (!match) return { amount: 0, suffix: "" };
  return { amount: Number(match[1]), suffix: match[2] ?? "" };
}

export function PricingSection() {
  return (
    <section id="pricing" className="relative overflow-hidden py-20">
      <ConcentricRings />
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <SplitHeading
          text="Choose Your Growth Partner."
          className="text-center text-3xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
          {TIER_ORDER.map((tier) => {
            const plan = PLANS[tier];
            const badge = MARKETING_BADGE[tier];
            const { amount, suffix } = splitPriceLabel(plan.priceLabel);
            return (
              <RevealItem key={tier}>
                <Card interactive className={cn("h-full", badge && "border-[var(--color-accent)]/40")}>
                  {badge && (
                    <Badge tone="accent" className="mb-3">
                      {badge}
                    </Badge>
                  )}
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-xl font-light text-[var(--color-text-primary)]">
                    <CountUp value={amount} prefix="$" suffix={suffix} />
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-[var(--color-text-secondary)]">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Magnetic strength={0.15} className="mt-6">
                    <Link
                      href="/sign-up"
                      className={cn(buttonVariants({ variant: badge ? "primary" : "secondary" }), "w-full")}
                    >
                      {tier === "FREE" ? "Start Now" : "Get Started"}
                    </Link>
                  </Magnetic>
                </Card>
              </RevealItem>
            );
          })}
        </RevealGroup>
        <Reveal delay={0.2}>
          <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
            Every plan starts free. Upgrade from inside your dashboard whenever
            you&apos;re ready — Outrun will always tell you exactly how many more
            qualified prospects are waiting once you hit a limit.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
