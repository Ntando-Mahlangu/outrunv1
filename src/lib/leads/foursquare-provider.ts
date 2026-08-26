import type { CompanyDataProvider, CompanySearchQuery, RawCompanyResult } from "./types";
import { withRetry, HttpError } from "@/lib/resilience/retry";
import { deriveSearchTerm } from "./derive-search-term";
import { UserFacingError } from "@/lib/errors";

// docs/outrun/06, docs/outrun/11 — a third option in the same
// CompanyDataProvider chain as Google Places, Yelp, and OpenStreetMap.
// Foursquare's Places API is a real, ToS-compliant API with a genuine
// (if modest) free monthly allowance: 500 free "Pro" calls/month as of
// their June 2026 pricing, then $15/1,000 — see DEPLOYMENT.md.
//
// Honesty note (docs/outrun/01 "never present uncertain output as
// certain"): rating/review-count data sits behind Foursquare's separate
// "Premium" tier, which has no free allowance at all — this provider
// never requests it, so rating/reviewCount always come back null here,
// same honest-degrade framing scoreCompany() (./scoring.ts) already
// applies to OSM/Yelp results missing that data.
const FOURSQUARE_SEARCH_URL = "https://places-api.foursquare.com/places/search";
const FOURSQUARE_API_VERSION = "2025-06-17";
const RESULT_LIMIT = 50;

type FoursquarePlace = {
  fsq_place_id?: string;
  fsq_id?: string;
  name: string;
  tel?: string;
  website?: string;
  categories?: Array<{ name: string }>;
  location?: { formatted_address?: string };
};

type FoursquareSearchResponse = {
  results?: FoursquarePlace[];
};

export class FoursquareProvider implements CompanyDataProvider {
  constructor(private apiKey: string) {}

  async search(query: CompanySearchQuery): Promise<RawCompanyResult[]> {
    // Same reasoning as OsmPlacesProvider/YelpProvider: no location means
    // nothing to search, not an error.
    if (!query.location.trim()) return [];

    const url = new URL(FOURSQUARE_SEARCH_URL);
    url.searchParams.set("near", query.location);
    const term = deriveSearchTerm(query);
    if (term) url.searchParams.set("query", term);
    url.searchParams.set("limit", String(RESULT_LIMIT));

    const data = await withRetry(async () => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "X-Places-Api-Version": FOURSQUARE_API_VERSION,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 400) {
          // Foursquare returns 400 when `near` can't be geocoded to a real
          // place at all — same distinct case OsmPlacesProvider surfaces
          // for Nominatim, rather than letting it read as "no businesses
          // found."
          throw new UserFacingError(
            `We couldn't find "${query.location}" as a location. Check the spelling, or try a nearby larger city.`,
          );
        }
        throw new HttpError(`Foursquare search failed: ${response.status} ${body}`, response.status);
      }

      return (await response.json()) as FoursquareSearchResponse;
    });

    return (data.results ?? []).map((place) => ({
      source: "foursquare",
      sourceId: place.fsq_place_id ?? place.fsq_id ?? place.name,
      name: place.name,
      category: place.categories?.[0]?.name ?? null,
      website: place.website ?? null,
      phone: place.tel ?? null,
      formattedAddress: place.location?.formatted_address ?? null,
      rating: null,
      reviewCount: null,
    }));
  }
}
