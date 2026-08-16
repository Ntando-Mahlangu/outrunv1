import { Card } from "@/components/ui/card";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { GenerativeLattice } from "@/components/motion/backgrounds";
import { SplitHeading } from "@/components/motion/split-heading";

const FEATURES = [
  {
    title: "AI Growth Blueprint",
    body: "Understand exactly how your business should grow — a scored, evidence-based strategy, not generic advice.",
  },
  {
    title: "AI Prospect Discovery",
    body: "Describe who you're looking for in plain English. Outrun finds qualified businesses and ranks them by fit.",
  },
  {
    title: "AI Company Research",
    body: "Know every prospect before reaching out — pain points, why they match, and a recommended contact angle.",
  },
  {
    title: "AI Outreach",
    body: "Generate a personalized first message from that research, with the reasoning behind every opening line.",
  },
  {
    title: "Campaign Builder",
    body: "Turn a list of researched prospects into a ready-to-send campaign, with follow-ups sequenced automatically.",
  },
  {
    title: "Weekly Growth Reviews",
    body: "A recurring strategic review of what changed, what worked, and what to prioritize next.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative overflow-hidden py-20">
      <GenerativeLattice />
      <div className="relative z-10 mx-auto max-w-5xl px-6">
        <SplitHeading
          text="Everything Outrun Does For You"
          className="text-center text-3xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <RevealGroup className="mt-12 grid gap-6 sm:grid-cols-2" stagger={0.08}>
          {FEATURES.map((feature) => (
            <RevealItem key={feature.title}>
              <Card interactive className="h-full p-8">
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{feature.body}</p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
