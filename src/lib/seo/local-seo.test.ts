import { describe, it, expect } from "vitest";
import { analyzeLocalSeoSignals } from "./local-seo";
import type { WebsiteSignals } from "./crawl";

function signals(overrides: Partial<WebsiteSignals> = {}): WebsiteSignals {
  return {
    url: "https://example.com",
    title: "Example",
    metaDescription: null,
    h1s: [],
    h2s: [],
    wordCount: 100,
    hasContactInfo: true,
    hasForm: true,
    linkCount: 10,
    imageCount: 5,
    imagesMissingAlt: 0,
    hasGoogleMapsEmbed: false,
    hasStreetAddressPattern: false,
    bodyTextLower: "welcome to our plumbing company",
    ...overrides,
  };
}

describe("analyzeLocalSeoSignals", () => {
  it("is not applicable when the business doesn't sell locally", () => {
    const result = analyzeLocalSeoSignals({
      sellingLocations: ["National"],
      inferredLocation: "Austin",
      signals: [signals()],
    });
    expect(result.applicable).toBe(false);
    expect(result.findings).toEqual([]);
  });

  it("flags a missing location mention when the site never mentions the inferred location", () => {
    const result = analyzeLocalSeoSignals({
      sellingLocations: ["Local"],
      inferredLocation: "Austin",
      signals: [signals({ bodyTextLower: "no city mentioned here" })],
    });
    expect(result.applicable).toBe(true);
    expect(result.findings).toContain(
      'Your website doesn\'t mention "Austin" anywhere — the location your last Growth Blueprint inferred you target.',
    );
  });

  it("confirms a location mention when the site's text contains it", () => {
    const result = analyzeLocalSeoSignals({
      sellingLocations: ["Local"],
      inferredLocation: "Austin",
      signals: [signals({ bodyTextLower: "proudly serving austin since 2010" })],
    });
    expect(result.findings).toContain(
      'Your website does mention "Austin" — the location your last Growth Blueprint inferred you target.',
    );
  });

  it("treats a generic inferred location as no location to check", () => {
    const result = analyzeLocalSeoSignals({
      sellingLocations: ["Local"],
      inferredLocation: "National",
      signals: [signals()],
    });
    expect(result.inferredLocation).toBeNull();
    expect(result.findings.some((f) => f.includes("National"))).toBe(false);
  });

  it("reports Google Maps embed and street address findings either way", () => {
    const result = analyzeLocalSeoSignals({
      sellingLocations: ["Local"],
      inferredLocation: null,
      signals: [signals({ hasGoogleMapsEmbed: true, hasStreetAddressPattern: true })],
    });
    expect(result.findings).toContain("Your website has a Google Maps embed.");
    expect(result.findings).toContain("Your website displays a street address.");
  });
});
