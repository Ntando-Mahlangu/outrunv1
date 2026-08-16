import type { CompanyDataProvider } from "./types";
import { GooglePlacesProvider } from "./google-places-provider";
import { OsmPlacesProvider } from "./osm-provider";

export type { CompanyDataProvider, RawCompanyResult } from "./types";

let provider: CompanyDataProvider | null = null;

/**
 * Same swap pattern as src/lib/ai/index.ts — one place decides the
 * provider. Google Places (paid, higher data quality — ratings, review
 * counts, more reliable phone/website) is used when configured;
 * OpenStreetMap (free, no key, weaker data quality — see osm-provider.ts)
 * is the zero-config default otherwise, so company search always works
 * out of the box. Set GOOGLE_PLACES_API_KEY whenever it's worth upgrading.
 */
export function getCompanyDataProvider(): CompanyDataProvider {
  if (provider) return provider;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  provider = apiKey ? new GooglePlacesProvider(apiKey) : new OsmPlacesProvider();
  return provider;
}

export function isCompanySearchConfigured(): boolean {
  return true;
}

/**
 * Surfaced to the client (src/app/api/prospects/search/route.ts) so a zero
 * results screen can tell the difference between "genuinely nothing out
 * there" and "running on the free provider, which is a geocoder — good at
 * resolving addresses and place names, not built for category+location
 * business search the way Google Places is" (see osm-provider.ts).
 * Without this, that distinction is invisible and reads as a bug.
 */
export function getActiveCompanyDataProviderName(): "google_places" | "openstreetmap" {
  return process.env.GOOGLE_PLACES_API_KEY ? "google_places" : "openstreetmap";
}
