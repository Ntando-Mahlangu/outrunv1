import type { CompanyDataProvider, CompanySearchQuery, RawCompanyResult } from "./types";
import { withRetry, HttpError } from "@/lib/resilience/retry";
import { deriveSearchTerm } from "./derive-search-term";
import { UserFacingError } from "@/lib/errors";

// docs/outrun/06, docs/outrun/11 — a second free option between Google
// Places (paid, best data) and OpenStreetMap (free, but coverage depends
// entirely on community mapping). Yelp Fusion is a real, ToS-compliant API
// (unlike scraping Google Maps through a tool like Map2Sheets, which
// violates Google's Terms of Service) with denser, more current coverage
// of the local-service categories Outrun targets — plumbers, HVAC,
// dentists, salons — since Yelp listings are largely maintained by the
// businesses themselves rather than volunteer mappers.
//
// One real limitation worth being honest about (docs/outrun/01 "never
// present uncertain output as certain"): Yelp's public API never returns
// a business's own website, only its Yelp listing page — so `website`
// comes back null for every result here, same as it often does on OSM.
// scoreCompany() (./scoring.ts) already treats a missing website as
// lower-confidence rather than "confirmed no site," which is the honest
// framing either way.
const YELP_SEARCH_URL = "https://api.yelp.com/v3/businesses/search";
const RESULT_LIMIT = 50;

type YelpBusiness = {
  id: string;
  name: string;
  phone?: string;
  display_phone?: string;
  rating?: number;
  review_count?: number;
  categories?: Array<{ alias: string; title: string }>;
  location?: { display_address?: string[] };
};

type YelpSearchResponse = {
  businesses?: YelpBusiness[];
};

export class YelpProvider implements CompanyDataProvider {
  constructor(private apiKey: string) {}

  async search(query: CompanySearchQuery): Promise<RawCompanyResult[]> {
    // Same reasoning as OsmPlacesProvider: no location means nothing to
    // search, not an error.
    if (!query.location.trim()) return [];

    const url = new URL(YELP_SEARCH_URL);
    url.searchParams.set("location", query.location);
    const term = deriveSearchTerm(query);
    if (term) url.searchParams.set("term", term);
    url.searchParams.set("limit", String(RESULT_LIMIT));

    const data = await withRetry(async () => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 400) {
          // Yelp returns 400 for a location it can't geocode at all —
          // same distinct case OsmPlacesProvider surfaces for Nominatim,
          // rather than letting it read as "no businesses found."
          throw new UserFacingError(
            `We couldn't find "${query.location}" as a location. Check the spelling, or try a nearby larger city.`,
          );
        }
        throw new HttpError(`Yelp search failed: ${response.status} ${body}`, response.status);
      }

      return (await response.json()) as YelpSearchResponse;
    });

    return (data.businesses ?? []).map((business) => ({
      source: "yelp",
      sourceId: business.id,
      name: business.name,
      category: business.categories?.[0]?.title ?? null,
      website: null,
      phone: business.phone || business.display_phone || null,
      formattedAddress: business.location?.display_address?.join(", ") || null,
      rating: business.rating ?? null,
      reviewCount: business.review_count ?? null,
    }));
  }
}
