import type { WebsiteSignals } from "./crawl";

export type LocalSeoVerifiedFindings = {
  applicable: boolean;
  inferredLocation: string | null;
  findings: string[];
};

// docs/outrun/09 "LOCAL SEO — If the business serves specific areas... Separate
// verified findings from suggestions." "Local citations" and "Map visibility
// improvements" are explicitly marked "(future)" in that same doc section, so
// they're deliberately not attempted here.
//
// Only "Local" in onboarding's sellingLocations pills means the business
// actually serves one specific area — "National"/"International"/"Remote"
// don't have a single place to be locally found in. `inferredLocation` (the
// latest Growth Blueprint's ICP.location, if any and not itself a generic
// value) is an existing AI inference being reused, not a fresh guess, and is
// only used to check the crawled page's own text — never presented as a
// confirmed fact about the business.
export function analyzeLocalSeoSignals(input: {
  sellingLocations: string[];
  inferredLocation: string | null;
  /** One or more crawled pages — a street address or Maps embed is just
   * as often on a Contact page as the homepage, so a finding counts if
   * ANY crawled page shows it, not just the first one. */
  signals: WebsiteSignals[];
}): LocalSeoVerifiedFindings {
  const applicable = input.sellingLocations.includes("Local");
  if (!applicable) {
    return { applicable: false, inferredLocation: null, findings: [] };
  }

  const genericLocations = new Set(["national", "international", "not specified", "remote", "online"]);
  const inferredLocation =
    input.inferredLocation && !genericLocations.has(input.inferredLocation.toLowerCase())
      ? input.inferredLocation
      : null;

  const findings: string[] = [];

  if (inferredLocation) {
    const mentioned = input.signals.some((s) => s.bodyTextLower.includes(inferredLocation.toLowerCase()));
    findings.push(
      mentioned
        ? `Your website does mention "${inferredLocation}" — the location your last Growth Blueprint inferred you target.`
        : `Your website doesn't mention "${inferredLocation}" anywhere — the location your last Growth Blueprint inferred you target.`,
    );
  }

  findings.push(
    input.signals.some((s) => s.hasGoogleMapsEmbed)
      ? "Your website has a Google Maps embed."
      : "Your website has no Google Maps embed.",
  );

  findings.push(
    input.signals.some((s) => s.hasStreetAddressPattern)
      ? "Your website displays a street address."
      : "No street address was found on your website.",
  );

  return { applicable: true, inferredLocation, findings };
}
