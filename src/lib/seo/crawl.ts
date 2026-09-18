import * as cheerio from "cheerio";
import { UserFacingError } from "@/lib/errors";
import { assertPubliclyRoutableUrl, ssrfSafeDispatcher } from "@/lib/security/ssrf";

export type WebsiteSignals = {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1s: string[];
  h2s: string[];
  wordCount: number;
  hasContactInfo: boolean;
  hasForm: boolean;
  linkCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  // docs/outrun/09 "LOCAL SEO" — real, procedurally-checkable signals
  // (never AI-guessed) that src/lib/seo/local-seo.ts turns into verified
  // findings, kept separate from the AI's own suggestions.
  hasGoogleMapsEmbed: boolean;
  hasStreetAddressPattern: boolean;
  bodyTextLower: string;
};

const GOOGLE_MAPS_PATTERN = /google\.com\/maps|maps\.google\.|google\.com\/maps\/embed/i;

// A loose but real signal, not a fabricated one: a number followed by a
// common US street-suffix word. False negatives (a real address written
// unusually) are expected and fine — this only ever produces a "not
// found" finding, never a false claim that an address exists.
const STREET_ADDRESS_PATTERN =
  /\d{1,6}\s+[a-z0-9.'\s]{0,40}\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|suite|ste)\b/i;

/**
 * The actual signal-extraction logic, split out from the fetch so it's
 * testable against fixture HTML without a network call (the fetch side
 * is already covered by the SSRF-guard tests).
 */
export function parseWebsiteSignals(url: string, html: string): WebsiteSignals {
  const $ = cheerio.load(html);

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const links = $("a[href]");
  const images = $("img");

  const hasContactInfo =
    $('a[href^="mailto:"]').length > 0 ||
    $('a[href^="tel:"]').length > 0 ||
    /contact/i.test(bodyText);

  const hasGoogleMapsEmbed =
    $('iframe[src*="google"]')
      .toArray()
      .some((el) => GOOGLE_MAPS_PATTERN.test($(el).attr("src") ?? "")) ||
    GOOGLE_MAPS_PATTERN.test(html);

  return {
    url,
    title: $("title").first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || null,
    h1s: $("h1").map((_, el) => $(el).text().trim()).get().filter(Boolean),
    h2s: $("h2").map((_, el) => $(el).text().trim()).get().filter(Boolean),
    wordCount: bodyText.split(" ").filter(Boolean).length,
    hasContactInfo,
    hasForm: $("form").length > 0,
    linkCount: links.length,
    imageCount: images.length,
    imagesMissingAlt: images.filter((_, el) => !$(el).attr("alt")?.trim()).length,
    hasGoogleMapsEmbed,
    hasStreetAddressPattern: STREET_ADDRESS_PATTERN.test(bodyText),
    bodyTextLower: bodyText.toLowerCase(),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "OutrunBot/1.0 (+https://outrun.app)" },
    signal: AbortSignal.timeout(10_000),
    redirect: "follow",
    // @ts-expect-error -- `dispatcher` is undici-specific and not in the
    // standard fetch() types, but Node's global fetch accepts it.
    dispatcher: ssrfSafeDispatcher,
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return response.text();
}

/**
 * Real HTTP fetch + HTML parse of the org's website (docs/outrun/09 "AI
 * WEBSITE CRAWL"). Only extracts what can actually be observed from the
 * HTML — never guesses at anything requiring a browser (speed, Core Web
 * Vitals) or an API this app doesn't have (Search Console).
 */
export async function crawlWebsite(url: string): Promise<WebsiteSignals> {
  try {
    assertPubliclyRoutableUrl(url);
  } catch (error) {
    throw new UserFacingError(
      error instanceof Error ? error.message : "That website URL isn't valid.",
    );
  }

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("status ")) {
      throw new UserFacingError(
        `That website returned an error (${error.message}). Check the URL and try again.`,
      );
    }
    throw new UserFacingError(
      "We couldn't reach that website. Check the URL and try again.",
    );
  }

  return parseWebsiteSignals(url, html);
}

// docs/outrun/09 "AI WEBSITE CRAWL" — a real SEO audit needs more than the
// homepage; the pages that actually carry local/service/pricing signal
// are usually elsewhere. Discovered via the site's own sitemap.xml
// (never guessed or invented paths), matched by keyword, capped small so
// one analysis can't turn into an uncontrolled crawl of the whole site.
const KEY_PAGE_KEYWORDS = ["about", "contact", "service", "pricing", "product", "blog"];
const MAX_ADDITIONAL_PAGES = 4;
const MAX_SITEMAP_URLS_SCANNED = 500;

export type WebsiteCrawlResult = {
  /** [homepage, ...whichever key pages were found and fetched]. Always
   * has at least one entry — the homepage — since that fetch throws on
   * failure; every other page is best-effort and silently skipped if it
   * can't be reached. */
  pages: WebsiteSignals[];
};

/** Real URLs only, from the site's own sitemap — never a guessed path
 * like "/about-us" that might not exist. Returns [] on any failure
 * (missing sitemap, non-XML response, etc.) rather than throwing, since
 * a site without a sitemap is common and shouldn't fail the whole crawl. */
async function discoverSitemapUrls(origin: string): Promise<string[]> {
  const sitemapUrl = `${origin}/sitemap.xml`;
  try {
    assertPubliclyRoutableUrl(sitemapUrl);
    const xml = await fetchHtml(sitemapUrl);
    const $ = cheerio.load(xml, { xmlMode: true });
    return $("url > loc, sitemap > loc")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, MAX_SITEMAP_URLS_SCANNED);
  } catch {
    return [];
  }
}

/** Same-origin URLs only, one per keyword, first match wins — a sitemap
 * can list hundreds of URLs, but only a handful of distinct page types
 * matter for an SEO read. */
export function selectKeyPageUrls(sitemapUrls: string[], origin: string, homepageUrl: string): string[] {
  const seen = new Set<string>([homepageUrl]);
  const selected: string[] = [];

  for (const keyword of KEY_PAGE_KEYWORDS) {
    if (selected.length >= MAX_ADDITIONAL_PAGES) break;
    for (const candidate of sitemapUrls) {
      let parsed: URL;
      try {
        parsed = new URL(candidate, origin);
      } catch {
        continue;
      }
      if (parsed.origin !== origin || seen.has(parsed.href)) continue;
      if (!parsed.pathname.toLowerCase().includes(keyword)) continue;
      seen.add(parsed.href);
      selected.push(parsed.href);
      break;
    }
  }

  return selected;
}

/**
 * The multi-page crawl used by the SEO analysis (docs/outrun/09). The
 * homepage crawl is the one part that can fail the whole operation (no
 * website reachable at all); everything past that — finding a sitemap,
 * picking key pages, fetching each — is best-effort, so a site with no
 * sitemap or a slow secondary page still gets a full analysis off
 * whatever it did fetch.
 */
export async function crawlWebsiteMultiPage(url: string): Promise<WebsiteCrawlResult> {
  const homepage = await crawlWebsite(url);
  const origin = new URL(homepage.url).origin;

  const sitemapUrls = await discoverSitemapUrls(origin);
  const keyPageUrls = selectKeyPageUrls(sitemapUrls, origin, homepage.url);

  const additionalPages = await Promise.all(
    keyPageUrls.map(async (pageUrl): Promise<WebsiteSignals | null> => {
      try {
        assertPubliclyRoutableUrl(pageUrl);
        const html = await fetchHtml(pageUrl);
        return parseWebsiteSignals(pageUrl, html);
      } catch {
        return null;
      }
    }),
  );

  return {
    pages: [homepage, ...additionalPages.filter((page): page is WebsiteSignals => page !== null)],
  };
}
