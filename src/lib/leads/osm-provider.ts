import type { CompanyDataProvider, CompanySearchQuery, OsmTag, RawCompanyResult } from "./types";
import { withRetry, HttpError } from "@/lib/resilience/retry";
import { isValidOsmTag } from "./osm-tags";
import { UserFacingError } from "@/lib/errors";

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

// Overpass QL's own [timeout:N] tells the *server* how long it may spend
// computing before giving up — it says nothing about how long our fetch
// should wait for the response. Giving the client a SHORTER timeout than
// the one baked into the query (as this used to do — 20s client vs. 25s
// server) means a broad query that's genuinely still within its own
// stated budget gets cut off by our side first, on every request that
// takes the full budget rather than just the unlucky slow ones. Padding
// the client timeout a few seconds past the server's own ceiling lets a
// response that finishes within budget actually reach us.
const OVERPASS_SERVER_TIMEOUT_SECONDS = 25;
const OVERPASS_FETCH_TIMEOUT_MS = (OVERPASS_SERVER_TIMEOUT_SECONDS + 5) * 1000;

// A broad, city-scale bounding box (Nominatim returns the full
// administrative boundary for a query like "Chicago" — often 30km+
// across) times an untagged generic fallback query (every shop/office/
// craft plus 14 amenity values, each doubled for node+way) is the
// slowest realistic case Overpass's shared public instance sees from
// this app — exactly what timed out in production. Clamping the box to
// a fixed span keeps that worst case tractable without needing a
// specific business-type tag to narrow it down.
const MAX_BBOX_SPAN_DEGREES = 0.3; // ~33km at the equator, less at higher latitudes

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

  return `[out:json][timeout:${OVERPASS_SERVER_TIMEOUT_SECONDS}];\n(\n${clauses.join("\n")}\n);\nout center ${RESULT_LIMIT};`;
}

/** Exported for testing — pure. Shrinks a bounding box symmetrically
 * around its center down to MAX_BBOX_SPAN_DEGREES on each axis, leaving
 * it untouched if it's already smaller. */
export function clampBboxSpan(
  south: number,
  west: number,
  north: number,
  east: number,
): [south: number, west: number, north: number, east: number] {
  const clampAxis = (min: number, max: number): [number, number] => {
    const span = max - min;
    if (span <= MAX_BBOX_SPAN_DEGREES) return [min, max];
    const center = (min + max) / 2;
    return [center - MAX_BBOX_SPAN_DEGREES / 2, center + MAX_BBOX_SPAN_DEGREES / 2];
  };
  const [clampedSouth, clampedNorth] = clampAxis(south, north);
  const [clampedWest, clampedEast] = clampAxis(west, east);
  return [clampedSouth, clampedWest, clampedNorth, clampedEast];
}

export class OsmPlacesProvider implements CompanyDataProvider {
  private async geocodeBoundingBox(location: string): Promise<string | null> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", location);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const results = await withRetry(
      async () => {
        const response = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new HttpError(`OpenStreetMap geocoding failed: ${response.status} ${body}`, response.status);
        }

        return (await response.json()) as NominatimResult[];
      },
      // withRetry's own default (3 attempts) plus this call's 10s timeout
      // would be fine alone, but combined with the Overpass call right
      // after it, the two need to fit inside one synchronous request the
      // user is actively waiting on — see the maxAttempts override there
      // for the full budget accounting.
      { maxAttempts: 2 },
    );

    const box = results[0]?.boundingbox;
    if (!box) return null;

    const [south, north, west, east] = box.map(Number) as [number, number, number, number];
    const [clampedSouth, clampedWest, clampedNorth, clampedEast] = clampBboxSpan(
      south,
      west,
      north,
      east,
    );
    return `${clampedSouth},${clampedWest},${clampedNorth},${clampedEast}`;
  }

  async search(query: CompanySearchQuery): Promise<RawCompanyResult[]> {
    // No location at all means there's nothing to geocode — genuinely
    // nothing to search rather than an error (see query-parser.ts's
    // fallback, which can legitimately produce an empty location).
    if (!query.location.trim()) return [];

    const bbox = await this.geocodeBoundingBox(query.location);
    if (!bbox) {
      // Distinct from "found the area, nothing tagged there" (a genuine
      // empty result) — Nominatim couldn't resolve this location string
      // to a place AT ALL, most often a misspelling the AI query parser
      // didn't catch (e.g. "Los Angels"). Silently returning [] here made
      // that read identically to "no matching businesses," which sends
      // the user chasing a data-coverage problem that isn't the actual
      // issue — the search never even reached the business lookup.
      throw new UserFacingError(
        `We couldn't find "${query.location}" as a location. Check the spelling, or try a nearby larger city.`,
      );
    }

    const overpassQuery = buildOverpassQuery(bbox, query.osmTags);

    const data = await withRetry(
      async () => {
        const response = await fetch(OVERPASS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
          },
          body: `data=${encodeURIComponent(overpassQuery)}`,
          signal: AbortSignal.timeout(OVERPASS_FETCH_TIMEOUT_MS),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new HttpError(`Overpass search failed: ${response.status} ${body}`, response.status);
        }

        return (await response.json()) as OverpassResponse;
      },
      // No retry here: a single attempt can already legitimately take up
      // to OVERPASS_FETCH_TIMEOUT_MS (30s), and this is a synchronous
      // request a real user is actively waiting on — a second full
      // attempt would risk the whole route outliving Vercel's own
      // function-duration ceiling (see maxDuration below) as well as the
      // user's patience. A query that timed out once at its own
      // server-side budget is also unlikely to finish meaningfully
      // faster on an immediate retry of the identical query, unlike the
      // quick geocoding lookup above (which does still retry). A
      // transient failure here just means the user clicks Search again.
      { maxAttempts: 1 },
    );

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
