export type RawCompanyResult = {
  source: string;
  sourceId: string;
  name: string;
  category: string | null;
  website: string | null;
  phone: string | null;
  formattedAddress: string | null;
  rating: number | null;
  reviewCount: number | null;
};

/** A single OSM tag (e.g. { key: "craft", value: "plumber" }) — see
 * src/lib/leads/osm-provider.ts for how these drive an Overpass query. */
export type OsmTag = { key: string; value: string };

/**
 * What src/lib/leads/query-parser.ts hands to a provider's search(). Every
 * provider gets the same query object but reads only what its own backend
 * can use: placesQuery (a combined industry+location phrase) is built for
 * Google Places' Text Search; location and osmTags are built for
 * OpenStreetMap's Overpass API, which — unlike Places — has no free-text
 * search and needs the location and business category kept apart.
 */
export type CompanySearchQuery = {
  placesQuery: string;
  location: string;
  osmTags: OsmTag[];
};

/**
 * Every lead-data vendor implements this one interface (docs/outrun/11,
 * docs/outrun/06 "API ARCHITECTURE" — never couple the app to one
 * provider). Swapping Google Places for Apollo or another provider means
 * writing one new class, not touching search/scoring/UI code.
 */
export interface CompanyDataProvider {
  search(query: CompanySearchQuery): Promise<RawCompanyResult[]>;
}
