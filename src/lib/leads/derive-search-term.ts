import type { CompanySearchQuery, OsmTag } from "./types";
import { isValidOsmTag, OSM_TAG_REFERENCE } from "./osm-tags";

/** Shared by every provider whose search API takes a free-text business-type
 * `term` separately from `location` (Yelp, Foursquare) — unlike Google
 * Places' combined phrase. Prefers the AI-picked OSM tag's human-readable
 * category (already curated in osm-tags.ts) since that's the cleanest
 * signal of "what kind of business," falling back to placesQuery with the
 * location portion stripped out when no tag was confidently picked. */
export function deriveSearchTerm(query: CompanySearchQuery): string {
  const tagCategory = firstKnownCategory(query.osmTags);
  if (tagCategory) return tagCategory;

  if (query.location.trim()) {
    const escapedLocation = query.location.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const stripped = query.placesQuery
      .replace(new RegExp(`\\b(in|near|around)\\s+${escapedLocation}\\b`, "i"), "")
      .replace(new RegExp(`\\b${escapedLocation}\\b`, "i"), "")
      .trim();
    if (stripped) return stripped;
  }

  return query.placesQuery;
}

function firstKnownCategory(tags: OsmTag[]): string | null {
  for (const tag of tags) {
    if (!isValidOsmTag(tag)) continue;
    const match = OSM_TAG_REFERENCE.find((r) => r.key === tag.key && r.value === tag.value);
    if (match) return match.category;
  }
  return null;
}
