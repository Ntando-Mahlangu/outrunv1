import { describe, it, expect } from "vitest";
import { parseWebsiteSignals, selectKeyPageUrls } from "./crawl";

describe("parseWebsiteSignals", () => {
  it("detects a Google Maps embed and a street address when present", () => {
    const html = `<!doctype html>
      <html>
      <head><title>Test Plumbing Co</title><meta name="description" content="Test"></head>
      <body>
        <h1>Test Plumbing Co</h1>
        <p>Located at 123 Main Street, Suite 4, we serve Austin and the surrounding area.</p>
        <iframe src="https://www.google.com/maps/embed?pb=abc123"></iframe>
        <a href="tel:5551234567">Call us</a>
        <form><input type="text" /></form>
      </body>
      </html>`;

    const signals = parseWebsiteSignals("https://example.com", html);

    expect(signals.hasGoogleMapsEmbed).toBe(true);
    expect(signals.hasStreetAddressPattern).toBe(true);
    expect(signals.bodyTextLower).toContain("austin");
    expect(signals.hasContactInfo).toBe(true);
    expect(signals.hasForm).toBe(true);
  });

  it("reports both signals as false when neither is present", () => {
    const html = `<!doctype html>
      <html>
      <head><title>No Signals Co</title></head>
      <body>
        <h1>No Signals Co</h1>
        <p>We do things. Contact us for more information.</p>
      </body>
      </html>`;

    const signals = parseWebsiteSignals("https://example.com", html);

    expect(signals.hasGoogleMapsEmbed).toBe(false);
    expect(signals.hasStreetAddressPattern).toBe(false);
  });
});

describe("selectKeyPageUrls", () => {
  const origin = "https://example.com";
  const homepage = "https://example.com/";

  it("picks one same-origin URL per keyword, in keyword order", () => {
    const sitemapUrls = [
      "https://example.com/",
      "https://example.com/blog/first-post",
      "https://example.com/contact-us",
      "https://example.com/about-us",
      "https://example.com/pricing",
    ];
    const selected = selectKeyPageUrls(sitemapUrls, origin, homepage);
    expect(selected).toEqual([
      "https://example.com/about-us",
      "https://example.com/contact-us",
      "https://example.com/pricing",
      "https://example.com/blog/first-post",
    ]);
  });

  it("never selects the homepage or an off-origin URL", () => {
    const sitemapUrls = [
      "https://example.com/",
      "https://evil.example.net/about",
      "https://example.com/about",
    ];
    const selected = selectKeyPageUrls(sitemapUrls, origin, homepage);
    expect(selected).toEqual(["https://example.com/about"]);
  });

  it("caps at 4 pages even when every keyword matches", () => {
    const sitemapUrls = [
      "https://example.com/about",
      "https://example.com/contact",
      "https://example.com/service",
      "https://example.com/pricing",
      "https://example.com/product",
      "https://example.com/blog",
    ];
    const selected = selectKeyPageUrls(sitemapUrls, origin, homepage);
    expect(selected).toHaveLength(4);
  });

  it("returns an empty list when nothing matches (e.g. no sitemap found)", () => {
    expect(selectKeyPageUrls([], origin, homepage)).toEqual([]);
  });
});
