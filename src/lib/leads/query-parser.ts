import { z } from "zod";
import { getAIProvider, isAIConfigured } from "@/lib/ai";
import type { RawCompanyResult } from "./types";
import { ALLOWED_OSM_TAG_KEYS, OSM_TAG_REFERENCE } from "./osm-tags";

const parsedQuerySchema = z.object({
  placesQuery: z.string(),
  location: z.string(),
  osmTags: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .max(5),
  postFilters: z.object({
    requireWebsite: z.boolean().nullable(),
    requireNoWebsite: z.boolean().nullable(),
    minRating: z.number().min(0).max(5).nullable(),
    minReviewCount: z.number().int().min(0).nullable(),
  }),
  unsupportedIntents: z.array(z.string()),
});

export type ParsedSearchQuery = z.infer<typeof parsedQuerySchema>;

const parsedQueryJsonSchema = {
  type: "object",
  properties: {
    placesQuery: { type: "string" },
    location: { type: "string" },
    osmTags: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
        },
        required: ["key", "value"],
      },
    },
    postFilters: {
      type: "object",
      properties: {
        requireWebsite: { type: ["boolean", "null"] },
        requireNoWebsite: { type: ["boolean", "null"] },
        minRating: { type: ["number", "null"], minimum: 0, maximum: 5 },
        minReviewCount: { type: ["integer", "null"], minimum: 0 },
      },
      required: ["requireWebsite", "requireNoWebsite", "minRating", "minReviewCount"],
    },
    unsupportedIntents: { type: "array", items: { type: "string" } },
  },
  required: ["placesQuery", "location", "osmTags", "postFilters", "unsupportedIntents"],
};

const OSM_TAG_REFERENCE_TEXT = OSM_TAG_REFERENCE.map((r) => `${r.category} → ${r.key}=${r.value}`).join("\n");

// docs/outrun/06 "GLOBAL SEARCH" — "The AI should interpret intent
// rather than relying on exact keywords." Google Places' Text Search
// handles a combined industry+location phrase well, but OpenStreetMap's
// Overpass API (src/lib/leads/osm-provider.ts) has no free-text search at
// all — it can only filter by structured tag within a geographic area, so
// the location and business-type parts of the request have to come out
// separately, not as one phrase. This step splits a free-text query into:
//   1. placesQuery — a clean industry+location phrase for Places
//   2. location / osmTags — the same request, decomposed for Overpass
//   3. postFilters — qualifiers Outrun can actually verify from data
//      either directory returns (website presence, rating, review count)
//   4. unsupportedIntents — everything else mentioned (funding, hiring,
//      tech stack, "weak SEO" beyond having no site at all) that gets
//      surfaced to the user honestly instead of silently dropped or,
//      worse, faked as a filter Outrun can't actually check.
const SYSTEM_PROMPT = `You turn a plain-English prospecting request into a structured search that can run against two different business directories: Google Places (a full-text search engine) and OpenStreetMap (which has no full-text search at all — only structured tags within a geographic area).

Neither directory has data on funding, hiring activity, technology stack, revenue, employee count, or website quality beyond "has a site or doesn't."

Produce all of the following:
- placesQuery: a short, clean phrase combining the industry/business type and location — what Google Places' text search should run on. Drop qualifiers Places can't use.
- location: JUST the geographic part of the request (city, region, neighborhood — resolve "near me"-style phrasing to nothing if no real place is named) — no business type, no qualifiers. This drives a separate geocoding step that only understands real place names, so correcting misspellings here matters far more than tidy capitalization: "chicargo" → "Chicago", "los angels" → "Los Angeles", "new york" → "New York". If you only capitalize a misspelled name without fixing the spelling (e.g. "Los Angels"), geocoding fails outright and the search finds nothing — so when in doubt, resolve to the well-known place the misspelling is clearly reaching for rather than preserving it.
- osmTags: up to 3 candidate OpenStreetMap tags (key/value pairs) that best match the requested business type. Reference — a known-correct key=value pair for common categories (use one of these verbatim when the category matches; for a closely related category not listed, extrapolate carefully in the same key/value style rather than guessing a shape that doesn't fit real OSM tagging):
${OSM_TAG_REFERENCE_TEXT}
  Allowed keys are only: ${ALLOWED_OSM_TAG_KEYS.join(", ")}. If the request doesn't name a specific business type (e.g. "any businesses in Austin"), return an empty array — never invent a tag for a category you're not confident about.
- postFilters: only set a field if the request clearly asked for it AND it maps to a real field either directory returns:
  - requireNoWebsite: true if they asked for businesses without a website / with no online presence
  - requireWebsite: true if they asked for businesses that do have a website
  - minRating / minReviewCount: only if they gave a concrete quality/popularity bar (OpenStreetMap never returns these, so they're a no-op there)
  Leave any field null if not clearly requested. Never guess a number that wasn't implied.
- unsupportedIntents: list every qualifier from the request that neither directory can verify (e.g. "raised funding", "recently hired staff", "uses HubSpot", "weak SEO", "growing fast") in plain English, exactly as the kind of claim it represents. If there are none, return an empty array. Never fold these into placesQuery, location, osmTags, or postFilters — never invent a way to "check" something neither directory can tell you.`;

export async function parseSearchQuery(query: string): Promise<ParsedSearchQuery> {
  if (!isAIConfigured()) {
    // Honest degradation: without an AI provider, fall back to exactly
    // what the user typed for Places, and a best-effort location guess
    // for Overpass — the same behavior this feature had before this
    // parsing step existed, extended just enough that OpenStreetMap search
    // still has something to geocode.
    return fallbackParse(query);
  }

  try {
    const ai = getAIProvider();
    return await ai.generateObject<ParsedSearchQuery>({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: query }],
      schema: parsedQuerySchema,
      jsonSchema: parsedQueryJsonSchema,
      toolName: "structure_search_query",
    });
  } catch {
    // A parsing failure shouldn't block the search itself — fall back
    // to the raw query, same as the unconfigured case above.
    return fallbackParse(query);
  }
}

function fallbackParse(query: string): ParsedSearchQuery {
  return {
    placesQuery: query,
    location: fallbackLocation(query),
    osmTags: [],
    postFilters: emptyFilters(),
    unsupportedIntents: [],
  };
}

// Best-effort split for when there's no AI to ask: most natural
// prospecting phrases ("plumbers in Chicago", "cafes near Austin") put the
// location after "in"/"near"/"around" — good enough to geocode even
// without understanding the request. Falls back to the whole query when no
// such split point is found.
function fallbackLocation(query: string): string {
  const match = query.match(/\b(?:in|near|around)\s+(.+)$/i);
  return match ? match[1]!.trim() : query.trim();
}

function emptyFilters(): ParsedSearchQuery["postFilters"] {
  return {
    requireWebsite: null,
    requireNoWebsite: null,
    minRating: null,
    minReviewCount: null,
  };
}

/** Pure filter application — kept separate from parseSearchQuery so it's
 * testable without an AI call. */
export function applyPostFilters(
  results: RawCompanyResult[],
  filters: ParsedSearchQuery["postFilters"],
): RawCompanyResult[] {
  return results.filter((r) => {
    if (filters.requireWebsite && !r.website) return false;
    if (filters.requireNoWebsite && r.website) return false;
    if (filters.minRating != null && (r.rating ?? 0) < filters.minRating) return false;
    if (filters.minReviewCount != null && (r.reviewCount ?? 0) < filters.minReviewCount) {
      return false;
    }
    return true;
  });
}
