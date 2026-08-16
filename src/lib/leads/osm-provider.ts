import type { CompanyDataProvider, CompanySearchQuery, OsmTag, RawCompanyResult } from "./types";
import { withRetry, HttpError } from "@/lib/resilience/retry";
import { isValidOsmTag } from "./osm-tags";

// docs/outrun/06, docs/outrun/11 — the free lead-data option behind the
// same CompanyDataProvider interface Google Places implements. No API key,
// no billing account, genuinely free — but it's two separate OpenStreetMap
// services chained together, not one search call like Google Places:
//   1. Nominatim geocodes query.location (a place name) to a bounding box —
//      this is exactly what Nominatim is built for and does well.
//   2. Overpass then finds tagged businesses inside that box — OSM has no
//      free-text business search at all, only structured tag filters, so
//      query.osmTags (from src/lib/leads/query-parser.ts's AI call) has to
//      carry the business-type half of the request instead of a phrase.
// The tradeoff is real and worth restating: Nominatim/Overpass index
// whatever OSM's community has tagged, so there's no concept of star
// ratings or review counts (scoreCompany in ./scoring.ts degrades
// gracefully when those are null), and business contact info (phone/
// website) is far patchier than Google Places, especially outside
// well-mapped regions.
//
// Both public instances (nominatim.openstreetmap.org, overpass-api.de)
// have real usage policies — max ~1 request/second and a required
// identifying User-Agent for Nominatim, a shared query-time budget for
// Overpass — fine for an early, low-volume launch, but self-host both (or
// move to a paid provider) before relying on this at real scale.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "Outrun/1.0 (+https://outrunv1.online)";
const RESULT_LIMIT = 60;

type NominatimResult = {
  // jsonv2's own order: [south, north, west, east], each a string.
  boundingbox?: [string, string, string, string];
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

// Fallback for a category the AI in query-parser.ts wasn't confident
// enough to tag (or wasn't run at all — see its isAIConfigured() branch).
// shop/office/craft are unambiguously businesses in OSM's schema — every
// value under those keys is a real shop/office/trade — so no value
// whitelist is needed for them. amenity=* is different: it also tags
// benches, parking, waste baskets, and dozens of other non-commercial
// infrastructure, so it gets its own whitelist of business-relevant values
// instead of a bare key match.
const GENERIC_KEY_ONLY_TAGS = ["shop", "office", "craft"] as const;
const GENERIC_AMENITY_VALUES = [
  "restaurant",
  "cafe",
  "fast_food",
  "bar",
  "pub",
  "bank",
  "pharmacy",
  "dentist",
  "clinic",
  "doctors",
  "veterinary",
  "car_wash",
  "cinema",
  "theatre",
];

function prettifyCategory(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAddress(tags: Record<string, string>): string | null {
  const streetLine = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const parts = [streetLine, tags["addr:city"], tags["addr:state"], tags["addr:postcode"]].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Exported for testing — pure, no network calls. bbox is already in
 * Overpass's own "south,west,north,east" order. */
export function buildOverpassQuery(bbox: string, tags: OsmTag[]): string {
  const valid = tags.filter(isValidOsmTag);

  const clauses =
    valid.length > 0
      ? valid.flatMap(({ key, value }) => [`node["${key}"="${value}"](${bbox});`, `way["${key}"="${value}"](${bbox});`])
      : [
          ...GENERIC_KEY_ONLY_TAGS.flatMap((key) => [`node["${key}"](${bbox});`, `way["${key}"](${bbox});`]),
          ...GENERIC_AMENITY_VALUES.flatMap((value) => [
            `node["amenity"="${value}"](${bbox});`,
            `way["amenity"="${value}"](${bbox});`,
          ]),
        ];

  return `[out:json][timeout:25];\n(\n${clauses.join("\n")}\n);\nout center ${RESULT_LIMIT};`;
}

export class OsmPlacesProvider implements CompanyDataProvider {
  private async geocodeBoundingBox(location: string): Promise<string | null> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", location);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const results = await withRetry(async () => {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new HttpError(`OpenStreetMap geocoding failed: ${response.status} ${body}`, response.status);
      }

      return (await response.json()) as NominatimResult[];
    });

    const box = results[0]?.boundingbox;
    if (!box) return null;

    const [south, north, west, east] = box;
    return `${south},${west},${north},${east}`;
  }

  async search(query: CompanySearchQuery): Promise<RawCompanyResult[]> {
    // No location at all means there's nothing to geocode — genuinely
    // nothing to search rather than an error (see query-parser.ts's
    // fallback, which can legitimately produce an empty location).
    if (!query.location.trim()) return [];

    const bbox = await this.geocodeBoundingBox(query.location);
    if (!bbox) return [];

    const overpassQuery = buildOverpassQuery(bbox, query.osmTags);

    const data = await withRetry(async () => {
      const response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new HttpError(`Overpass search failed: ${response.status} ${body}`, response.status);
      }

      return (await response.json()) as OverpassResponse;
    });

    const seen = new Set<string>();
    const results: RawCompanyResult[] = [];

    for (const element of data.elements) {
      const tags = element.tags;
      if (!tags?.name) continue; // an unnamed feature isn't a usable prospect

      const sourceId = `${element.type}/${element.id}`;
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);

      results.push({
        source: "openstreetmap",
        sourceId,
        name: tags.name,
        category: prettifyCategory(
          tags.shop ?? tags.amenity ?? tags.craft ?? tags.office ?? tags.healthcare ?? tags.leisure ?? tags.tourism,
        ),
        website: tags.website ?? tags["contact:website"] ?? null,
        phone: tags.phone ?? tags["contact:phone"] ?? null,
        formattedAddress: formatAddress(tags),
        rating: null,
        reviewCount: null,
      });
    }

    return results;
  }
}
