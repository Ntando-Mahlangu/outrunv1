import { describe, it, expect } from "vitest";
import { buildOverpassQuery } from "./osm-provider";

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
