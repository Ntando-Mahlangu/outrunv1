import { describe, it, expect } from "vitest";
import { buildOverpassQuery, clampBboxSpan } from "./osm-provider";

const BBOX = "41.6,-87.9,42.0,-87.5"; // south,west,north,east

describe("buildOverpassQuery", () => {
  it("filters by the given tag when it's on the allowlist", () => {
    const query = buildOverpassQuery(BBOX, [{ key: "craft", value: "plumber" }]);
    expect(query).toContain(`node["craft"="plumber"](${BBOX});`);
    expect(query).toContain(`way["craft"="plumber"](${BBOX});`);
  });

  it("includes a clause for every valid tag given", () => {
    const query = buildOverpassQuery(BBOX, [
      { key: "craft", value: "plumber" },
      { key: "craft", value: "electrician" },
    ]);
    expect(query).toContain(`node["craft"="plumber"](${BBOX});`);
    expect(query).toContain(`node["craft"="electrician"](${BBOX});`);
  });

  it("drops a tag whose key isn't on the allowlist", () => {
    const query = buildOverpassQuery(BBOX, [{ key: "building", value: "commercial" }]);
    expect(query).not.toContain("building");
    // Falls through to the generic fallback since nothing valid remains.
    expect(query).toContain(`node["shop"](${BBOX});`);
  });

  it("drops a tag whose value isn't valid OSM tagging convention", () => {
    const query = buildOverpassQuery(BBOX, [{ key: "shop", value: "Hardware Store" }]);
    expect(query).not.toContain("Hardware Store");
    expect(query).toContain(`node["shop"](${BBOX});`);
  });

  it("falls back to generic business tags when no tags are given", () => {
    const query = buildOverpassQuery(BBOX, []);
    expect(query).toContain(`node["shop"](${BBOX});`);
    expect(query).toContain(`node["office"](${BBOX});`);
    expect(query).toContain(`node["craft"](${BBOX});`);
    expect(query).toContain(`node["amenity"="restaurant"](${BBOX});`);
    // The generic fallback never emits a bare amenity match — that key is
    // overloaded with non-commercial infrastructure (benches, parking...).
    expect(query).not.toContain(`node["amenity"](${BBOX});`);
  });

  it("always scopes clauses to the given bounding box", () => {
    const query = buildOverpassQuery(BBOX, [{ key: "office", value: "lawyer" }]);
    expect(query).toContain(BBOX);
  });
});

describe("clampBboxSpan", () => {
  it("leaves a box already within the max span untouched", () => {
    expect(clampBboxSpan(41.6, -87.8, 41.8, -87.6)).toEqual([41.6, -87.8, 41.8, -87.6]);
  });

  it("shrinks an oversized box to the max span, centered on the original", () => {
    // A real Nominatim result for "Chicago" — a ~1.1° x ~0.9° admin boundary,
    // well past the 0.3° cap this is meant to enforce.
    const [south, west, north, east] = clampBboxSpan(41.6, -87.94, 42.02, -87.52);
    expect(north - south).toBeCloseTo(0.3, 5);
    expect(east - west).toBeCloseTo(0.3, 5);
    // Centered on the original box's center, not shifted to a corner.
    expect((south + north) / 2).toBeCloseTo((41.6 + 42.02) / 2, 5);
    expect((west + east) / 2).toBeCloseTo((-87.94 + -87.52) / 2, 5);
  });

  it("clamps each axis independently", () => {
    // Tall and narrow: only the north/south axis needs shrinking.
    const [south, west, north, east] = clampBboxSpan(40.0, -87.6, 41.0, -87.5);
    expect(north - south).toBeCloseTo(0.3, 5);
    expect(east - west).toBeCloseTo(0.1, 5); // untouched
  });
});
