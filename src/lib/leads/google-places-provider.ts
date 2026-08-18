import type { CompanyDataProvider, CompanySearchQuery, RawCompanyResult } from "./types";
import { withRetry, HttpError } from "@/lib/resilience/retry";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryTypeDisplayName",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
].join(",");

type PlacesTextSearchResponse = {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    primaryTypeDisplayName?: { text?: string };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
  }>;
};

export class GooglePlacesProvider implements CompanyDataProvider {
  constructor(private apiKey: string) {}

  async search(query: CompanySearchQuery): Promise<RawCompanyResult[]> {
    // placesQuery is an industry+location phrase, not a raw free-text
    // request — src/lib/leads/query-parser.ts strips qualifiers Places
    // can't search on (funding, hiring activity, tech stack, etc.) before
    // this is called. location/osmTags exist only for OpenStreetMap's
    // Overpass API (see osm-provider.ts) and don't apply here.
    const data = await withRetry(async () => {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify({ textQuery: query.placesQuery }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new HttpError(`Google Places search failed: ${response.status} ${body}`, response.status);
      }

      return (await response.json()) as PlacesTextSearchResponse;
    });

    return (data.places ?? []).map((place) => ({
      source: "google_places",
      sourceId: place.id,
      name: place.displayName?.text ?? "Unnamed business",
      category: place.primaryTypeDisplayName?.text ?? null,
      website: place.websiteUri ?? null,
      phone: place.nationalPhoneNumber ?? null,
      formattedAddress: place.formattedAddress ?? null,
      rating: place.rating ?? null,
      reviewCount: place.userRatingCount ?? null,
    }));
  }
}
