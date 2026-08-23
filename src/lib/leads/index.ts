import type { CompanyDataProvider } from "./types";
import { GooglePlacesProvider } from "./google-places-provider";
import { YelpProvider } from "./yelp-provider";
import { OsmPlacesProvider } from "./osm-provider";

export type { CompanyDataProvider, RawCompanyResult } from "./types";

let provider: CompanyDataProvider | null = null;

/**
 * Same swap pattern as src/lib/ai/index.ts — one place decides the
 * provider, in order of data quality: Google Places (paid, best data —
 * ratings, review counts, reliable phone/website) if configured; else Yelp
 * (free, real API — denser local-business coverage than OSM but never
 * returns a business's own website, see yelp-provider.ts) if configured;
 * else OpenStreetMap (free, no key, coverage depends entirely on
 * volunteer mapping — see osm-provider.ts) as the zero-config default, so
 * company search always works out of the box.
 */
export function getCompanyDataProvider(): CompanyDataProvider {
  if (provider) return provider;

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const yelpKey = process.env.YELP_API_KEY;
  provider = googleKey
    ? new GooglePlacesProvider(googleKey)
    : yelpKey
      ? new YelpProvider(yelpKey)
      : new OsmPlacesProvider();
  return provider;
}

export function isCompanySearchConfigured(): boolean {
  return true;
}

/**
 * Surfaced to the client (src/app/api/prospects/search/route.ts) so a zero
 * results screen can tell the difference between "genuinely nothing out
 * there" and a known limitation of whichever free provider is active.
 * Without this, that distinction is invisible and reads as a bug.
 */
export function getActiveCompanyDataProviderName(): "google_places" | "yelp" | "openstreetmap" {
  if (process.env.GOOGLE_PLACES_API_KEY) return "google_places";
  if (process.env.YELP_API_KEY) return "yelp";
  return "openstreetmap";
}
