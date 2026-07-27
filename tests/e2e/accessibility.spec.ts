import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createAuthenticatedOrg, deleteOrg } from "./helpers/authenticated-org";

// docs/outrun/15 "CI/CD" — "Every pull request must pass: ... Accessibility
// Checks."
const PUBLIC_PAGES = ["/", "/privacy", "/terms", "/security", "/sign-in", "/sign-up"];

async function expectNoSeriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const seriousOrWorse = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    seriousOrWorse,
    seriousOrWorse
      .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`)
      .join("\n"),
  ).toEqual([]);
}

test.describe("accessibility — public pages", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      await expectNoSeriousViolations(page);
    });
  }
});

// docs/outrun/15 "CI/CD" — the authenticated app's key flows, fixed under
// the dedicated accessibility pass (docs/outrun/16 punch list). Uses a
// throwaway organization seeded directly via Prisma (bypassing email
// verification, since there's no way to click a real link in CI) so
// these pages render with real data instead of every empty state.
const AUTHENTICATED_PAGES = [
  "/dashboard",
  "/prospects",
  "/prospects/lists",
  "/campaigns",
  "/campaigns/new",
  "/campaigns/library",
  "/tasks",
  "/goals",
  "/memory",
  "/settings/team",
  "/settings/security",
  "/settings/brand-voice",
  "/settings/api-keys",
  "/settings/webhooks",
  "/billing",
  "/growth-partner",
  "/seo",
];

test.describe("accessibility — authenticated app", () => {
  let organizationId: string;
  let companyId: string;
  let cookie: { name: string; value: string };

  test.beforeAll(async ({ baseURL }) => {
    const org = await createAuthenticatedOrg(baseURL!);
    organizationId = org.organizationId;
    companyId = org.companyId;
    cookie = org.cookie;
  });

  test.afterAll(async () => {
    if (organizationId) await deleteOrg(organizationId);
  });

  test.beforeEach(async ({ page, baseURL }) => {
    await page.context().addCookies([{ ...cookie, url: baseURL! }]);
  });

  for (const path of AUTHENTICATED_PAGES) {
    test(`${path} has no serious or critical axe violations`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      await expectNoSeriousViolations(page);
    });
  }

  test("prospect detail page has no serious or critical axe violations", async ({ page }) => {
    await page.goto(`/prospects/${companyId}`, { waitUntil: "networkidle" });
    await expectNoSeriousViolations(page);
  });
});
