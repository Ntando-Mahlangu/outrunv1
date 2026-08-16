import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { GenerativeLattice } from "@/components/motion/backgrounds";
import { SplitHeading } from "@/components/motion/split-heading";

const FAQS = [
  {
    q: "What makes Outrun different?",
    a: "Most tools show you data. Outrun tells you what to do next, and explains why — based on your own business, not generic advice.",
  },
  {
    q: "How does the AI work?",
    a: "Outrun reasons from what you actually tell it and what it can verify (like whether a prospect has a website). It never invents facts, and it always separates observations from assumptions.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel your subscription anytime from Billing — no phone calls, no retention maze.",
  },
  {
    q: "Is my business data secure?",
    a: "Your workspace is fully isolated from every other account, sessions are encrypted, and plan access is only ever changed by verified billing events — never by anything the browser sends.",
  },
  {
    q: "How accurate are the recommendations?",
    a: "Every score and recommendation states its confidence and the reasoning behind it. Outrun would rather tell you it's unsure than guess silently.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="relative overflow-hidden py-20">
      <GenerativeLattice />
      <div className="relative z-10 mx-auto max-w-3xl px-6">
        <SplitHeading
          text="Questions"
          className="text-center text-3xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <RevealGroup className="mt-10 space-y-8" stagger={0.08}>
          {FAQS.map((faq) => (
            <RevealItem key={faq.q}>
              <h3 className="text-base font-medium text-[var(--color-text-primary)]">{faq.q}</h3>
              <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">{faq.a}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
