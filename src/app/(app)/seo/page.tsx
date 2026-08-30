import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { SeoPageClient } from "@/components/seo/seo-page-client";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/billing/feature-flags";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { SEOAnalysisData, LocalSeoPersisted } from "@/lib/seo/schema";

export default async function SeoPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");
  if (!organization.businessProfile) redirect("/onboarding");

  if (!isFeatureEnabled(organization.planTier, FEATURE_FLAGS.SEO_ENGINE, organization.id)) {
    return (
      <Card interactive className="animate-fade-in">
        <h1 className="text-xl font-medium text-[var(--color-text-primary)]">
          SEO Engine is a Starter feature
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Upgrade to Starter to crawl your site, get a health score, keyword suggestions, and
          AI-generated content ideas.
        </p>
        <Link href="/billing" className={cn(buttonVariants(), "mt-4 inline-flex")}>
          View plans
        </Link>
      </Card>
    );
  }

  const [analysis, contentPieces] = await Promise.all([
    prisma.seoAnalysis.findFirst({
      where: { organizationId: organization.id },
      orderBy: { version: "desc" },
    }),
    prisma.seoContentPiece.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <SeoPageClient
      website={organization.website}
      analysis={
        analysis
          ? {
              healthScore: analysis.healthScore,
              executiveSummary: analysis.executiveSummary,
              categories: analysis.categories as SEOAnalysisData["categories"],
              quickWins: analysis.quickWins as SEOAnalysisData["quickWins"],
              keywordSuggestions: analysis.keywordSuggestions as SEOAnalysisData["keywordSuggestions"],
              contentIdeas: analysis.contentIdeas as SEOAnalysisData["contentIdeas"],
              localSeo: analysis.localSeo as LocalSeoPersisted | null,
              version: analysis.version,
            }
          : null
      }
      contentPieces={contentPieces}
    />
  );
}
