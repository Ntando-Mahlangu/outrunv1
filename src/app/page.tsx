import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { MarketingNav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { PainSection } from "@/components/marketing/pain-section";
import { SolutionSection } from "@/components/marketing/solution-section";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { WowDemo } from "@/components/marketing/wow-demo";
import { FeaturesSection } from "@/components/marketing/features-section";
import { WhyOutrun } from "@/components/marketing/why-outrun";
import { ProductPhilosophy } from "@/components/marketing/product-philosophy";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { MarketingFooter } from "@/components/marketing/footer";

export default async function RootPage() {
  const session = await getCurrentSession();
  if (session) redirect("/welcome");

  return (
    <main className="bg-[var(--color-bg-primary)]">
      <MarketingNav />
      <Hero />
      <PainSection />
      <SolutionSection />
      <HowItWorks />
      <WowDemo />
      <FeaturesSection />
      <WhyOutrun />
      <ProductPhilosophy />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <MarketingFooter />
    </main>
  );
}
