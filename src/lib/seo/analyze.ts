import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import * as growthBlueprintRepository from "@/lib/repositories/growth-blueprint-repository";
import { crawlWebsiteMultiPage, type WebsiteSignals } from "./crawl";
import { analyzeLocalSeoSignals, type LocalSeoVerifiedFindings } from "./local-seo";
import { getSeoMemory, type SeoMemory } from "./memory";
import { seoAnalysisSchema, seoAnalysisJsonSchema, type SEOAnalysisData } from "./schema";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";

const SYSTEM_PROMPT = `You are Outrun's AI SEO Growth Consultant (docs/outrun/09). Explain SEO in
plain English for a business owner, not an SEO professional.

Rules you must follow (non-negotiable):
- Only use the crawled signals given to you — for each page crawled
  (the homepage plus whichever key pages were found and reachable):
  title, meta description, headings, word count, whether contact
  info/forms were found, link and image counts — plus the business's
  own description. Never guess at anything you weren't given (page
  speed, Core Web Vitals, search rankings, backlinks) — these require
  integrations this app doesn't have yet.
- Only one page was crawled if that's all that's given you (e.g. no
  sitemap was found) — say so plainly rather than implying a full-site
  audit happened.
- Every category score needs a reason grounded in the actual signals.
- Executive summary: under 300 words, plain English, no jargon.
- Quick wins should be genuinely quick — things fixable in under an hour.
- Local SEO (docs/outrun/09 "LOCAL SEO"): fill in localSeo ONLY when told
  the business serves a specific local area — set it to null otherwise.
  When filling it in, only recommend location pages, local keywords,
  Google Business Profile optimization, and a review strategy — nothing
  about local citations or map-pack visibility, those aren't built yet.
  You'll be given verified findings (e.g. whether the site has a Google
  Maps embed) — reference them in your suggestions rather than repeating
  them as if they were your own discovery.
- SEO Memory (docs/outrun/09 "SEO MEMORY"): you'll be told which
  keywords past analyses already suggested and which keywords already
  have drafted content. Don't re-suggest those — find new keyword and
  content opportunities instead. It's fine to keep a prior keyword only
  if it's still clearly the single most important one for this business,
  but the majority of keywordSuggestions and contentIdeas should be new.`;

function describePage(signals: WebsiteSignals): string {
  return [
    `Page: ${signals.url}`,
    `Title tag: ${signals.title ?? "missing"}`,
    `Meta description: ${signals.metaDescription ?? "missing"}`,
    `H1 headings: ${signals.h1s.join(" | ") || "none found"}`,
    `H2 headings: ${signals.h2s.slice(0, 10).join(" | ") || "none found"}`,
    `Word count: ${signals.wordCount}`,
    `Contact info found: ${signals.hasContactInfo ? "yes" : "no"}`,
    `Form found: ${signals.hasForm ? "yes" : "no"}`,
    `Link count: ${signals.linkCount}`,
    `Images: ${signals.imageCount} (${signals.imagesMissingAlt} missing alt text)`,
  ].join("\n");
}

function buildUserMessage(
  pages: WebsiteSignals[],
  businessDescription: string,
  idealCustomer: string,
  localSeo: LocalSeoVerifiedFindings,
  memory: SeoMemory,
) {
  return [
    `Business: ${businessDescription}`,
    `Ideal customer: ${idealCustomer}`,
    "",
    `${pages.length} page${pages.length === 1 ? "" : "s"} crawled` +
      (pages.length === 1 ? " (no other key pages were found via the site's sitemap)." : ":"),
    "",
    pages.map(describePage).join("\n\n"),
    "",
    localSeo.applicable
      ? `This business serves a specific local area. Verified findings:\n${localSeo.findings.map((f) => `- ${f}`).join("\n")}`
      : "This business does not serve a specific local area (sells nationally, internationally, or remote/online only) — set localSeo to null.",
    "",
    memory.priorKeywords.length > 0
      ? `Keywords already suggested in past analyses (avoid repeating): ${memory.priorKeywords.join(", ")}`
      : "No past analyses yet — no prior keyword suggestions to avoid repeating.",
    memory.draftedContentKeywords.length > 0
      ? `Keywords that already have drafted content (strongly avoid duplicating): ${memory.draftedContentKeywords.join(", ")}`
      : "No content has been drafted yet.",
    "",
    "Produce a complete SEO analysis from this information alone.",
  ].join("\n");
}

export async function analyzeSEO(organizationId: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { businessProfile: true },
  });
  if (!organization.businessProfile) {
    throw new UserFacingError("Finish Business Discovery before running an SEO analysis.");
  }
  if (!organization.website) {
    throw new UserFacingError(
      "Add your website below before running an SEO analysis.",
    );
  }

  const { pages } = await crawlWebsiteMultiPage(organization.website);

  const latestBlueprint = await growthBlueprintRepository.findLatestIcpForOrg(organizationId);
  const icp = (latestBlueprint?.idealCustomerProfile ??
    null) as GrowthBlueprintData["idealCustomerProfile"] | null;
  const localSeo = analyzeLocalSeoSignals({
    sellingLocations: organization.businessProfile.sellingLocations,
    inferredLocation: icp?.location ?? null,
    signals: pages,
  });
  const memory = await getSeoMemory(organizationId);

  const ai = getAIProvider();
  const data = await ai.generateObject<SEOAnalysisData>({
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage(
          pages,
          organization.businessProfile.description,
          organization.businessProfile.idealCustomer,
          localSeo,
          memory,
        ),
      },
    ],
    schema: seoAnalysisSchema,
    jsonSchema: seoAnalysisJsonSchema,
    toolName: "seo_analysis",
  });

  const previous = await prisma.seoAnalysis.findFirst({
    where: { organizationId },
    orderBy: { version: "desc" },
  });

  // `localSeo.applicable` (computed from sellingLocations, not asked of
  // the model) is the source of truth for whether this section exists at
  // all — the AI's own null/non-null choice on data.localSeo is only
  // trusted for the suggestions inside it, not for this decision.
  const persistedLocalSeo = localSeo.applicable
    ? {
        verifiedFindings: localSeo.findings,
        locationPageRecommendations: data.localSeo?.locationPageRecommendations ?? [],
        localKeywordRecommendations: data.localSeo?.localKeywordRecommendations ?? [],
        googleBusinessProfileTips: data.localSeo?.googleBusinessProfileTips ?? [],
        reviewStrategyTips: data.localSeo?.reviewStrategyTips ?? [],
      }
    : null;

  const analysis = await prisma.seoAnalysis.create({
    data: {
      organizationId,
      version: (previous?.version ?? 0) + 1,
      healthScore: data.healthScore,
      executiveSummary: data.executiveSummary,
      categories: data.categories,
      quickWins: data.quickWins,
      keywordSuggestions: data.keywordSuggestions,
      contentIdeas: data.contentIdeas,
      localSeo: persistedLocalSeo ?? undefined,
    },
  });

  await logEvent(
    organizationId,
    EventType.SEO_ANALYZED,
    `SEO analysis run — health score ${data.healthScore}/100.`,
  );

  return analysis;
}
