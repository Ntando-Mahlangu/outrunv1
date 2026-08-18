/**
 * Reference/allowlist for OSM tags used to translate a plain-English
 * business category into Overpass query filters (src/lib/leads/osm-provider.ts).
 * Only these keys are ever placed into an Overpass QL query — anything else
 * src/lib/leads/query-parser.ts's AI call proposes is silently dropped
 * rather than passed unvalidated into a query string built from model
 * output.
 */
export const ALLOWED_OSM_TAG_KEYS = [
  "shop",
  "amenity",
  "craft",
  "office",
  "healthcare",
  "leisure",
  "tourism",
] as const;

export type AllowedOsmTagKey = (typeof ALLOWED_OSM_TAG_KEYS)[number];

const ALLOWED_KEY_SET = new Set<string>(ALLOWED_OSM_TAG_KEYS);

// OSM's own tagging convention for values: lowercase letters, digits,
// underscores — never spaces or mixed case.
const VALID_VALUE_PATTERN = /^[a-z0-9_]+$/;

export function isValidOsmTag(tag: { key: string; value: string }): boolean {
  return ALLOWED_KEY_SET.has(tag.key) && VALID_VALUE_PATTERN.test(tag.value);
}

/**
 * Grounds query-parser.ts's AI call in real OSM tagging convention instead
 * of letting it guess freehand — OSM's schema is specific (plumbers are
 * tagged craft=plumber, not shop=plumber) and a plausible-sounding wrong
 * guess just silently returns nothing from Overpass. Not exhaustive — the
 * model can propose a tag outside this list when it's confident about the
 * category; this is calibration, not a hard restriction. Every entry here
 * is a real, commonly-used OSM tag.
 */
export const OSM_TAG_REFERENCE: Array<{ category: string; key: AllowedOsmTagKey; value: string }> = [
  { category: "restaurant", key: "amenity", value: "restaurant" },
  { category: "cafe / coffee shop", key: "amenity", value: "cafe" },
  { category: "fast food", key: "amenity", value: "fast_food" },
  { category: "bar", key: "amenity", value: "bar" },
  { category: "pub", key: "amenity", value: "pub" },
  { category: "bakery", key: "shop", value: "bakery" },
  { category: "supermarket / grocery store", key: "shop", value: "supermarket" },
  { category: "convenience store", key: "shop", value: "convenience" },
  { category: "clothing store", key: "shop", value: "clothes" },
  { category: "shoe store", key: "shop", value: "shoes" },
  { category: "hardware store", key: "shop", value: "hardware" },
  { category: "electronics store", key: "shop", value: "electronics" },
  { category: "furniture store", key: "shop", value: "furniture" },
  { category: "bookstore", key: "shop", value: "books" },
  { category: "florist", key: "shop", value: "florist" },
  { category: "jewelry store", key: "shop", value: "jewelry" },
  { category: "toy store", key: "shop", value: "toys" },
  { category: "pet store", key: "shop", value: "pet" },
  { category: "car dealership", key: "shop", value: "car" },
  { category: "auto repair shop", key: "shop", value: "car_repair" },
  { category: "bicycle shop", key: "shop", value: "bicycle" },
  { category: "hair salon / hairdresser / barber", key: "shop", value: "hairdresser" },
  { category: "beauty salon / spa", key: "shop", value: "beauty" },
  { category: "massage therapist", key: "shop", value: "massage" },
  { category: "plumber", key: "craft", value: "plumber" },
  { category: "electrician", key: "craft", value: "electrician" },
  { category: "carpenter", key: "craft", value: "carpenter" },
  { category: "painter (house painting)", key: "craft", value: "painter" },
  { category: "HVAC / heating and cooling", key: "craft", value: "hvac" },
  { category: "roofer", key: "craft", value: "roofer" },
  { category: "locksmith", key: "craft", value: "locksmith" },
  { category: "photographer", key: "craft", value: "photographer" },
  { category: "tailor", key: "craft", value: "tailor" },
  { category: "lawyer / law firm / attorney", key: "office", value: "lawyer" },
  { category: "accountant / accounting firm", key: "office", value: "accountant" },
  { category: "insurance agency", key: "office", value: "insurance" },
  { category: "real estate agency", key: "office", value: "estate_agent" },
  { category: "IT / tech company", key: "office", value: "it" },
  { category: "advertising / marketing agency", key: "office", value: "advertising_agency" },
  { category: "financial advisor", key: "office", value: "financial_advisor" },
  { category: "architect", key: "office", value: "architect" },
  { category: "dentist", key: "amenity", value: "dentist" },
  { category: "doctor's office / medical clinic", key: "amenity", value: "clinic" },
  { category: "pharmacy", key: "amenity", value: "pharmacy" },
  { category: "veterinarian", key: "amenity", value: "veterinary" },
  { category: "physiotherapist", key: "healthcare", value: "physiotherapist" },
  { category: "gym / fitness center", key: "leisure", value: "fitness_centre" },
  { category: "sports center", key: "leisure", value: "sports_centre" },
  { category: "hotel", key: "tourism", value: "hotel" },
  { category: "guest house / bed and breakfast", key: "tourism", value: "guest_house" },
];
