import { describe, it, expect } from "vitest";
import { deriveYelpTerm } from "./yelp-provider";

describe("deriveYelpTerm", () => {
  it("prefers a known category from a valid OSM tag", () => {
    const term = deriveYelpTerm({
      placesQuery: "plumbers in Chicago",
      location: "Chicago",
      osmTags: [{ key: "craft", value: "plumber" }],
    });
    expect(term).toBe("plumber");
  });

  it("ignores a tag that isn't on the allowlist and falls through to placesQuery", () => {
    const term = deriveYelpTerm({
      placesQuery: "commercial buildings in Chicago",
      location: "Chicago",
      osmTags: [{ key: "building", value: "commercial" }],
    });
    expect(term).toBe("commercial buildings");
  });

  it("strips the location out of placesQuery when there's no usable tag", () => {
    const term = deriveYelpTerm({
      placesQuery: "cafes near Austin",
      location: "Austin",
      osmTags: [],
    });
    expect(term).toBe("cafes");
  });

  it("falls back to the raw placesQuery when location can't be stripped out", () => {
    const term = deriveYelpTerm({
      placesQuery: "any businesses",
      location: "Austin",
      osmTags: [],
    });
    expect(term).toBe("any businesses");
  });

  it("handles a location containing regex special characters safely", () => {
    const term = deriveYelpTerm({
      placesQuery: "dentists in St. Louis",
      location: "St. Louis",
      osmTags: [],
    });
    expect(term).toBe("dentists");
  });
});
