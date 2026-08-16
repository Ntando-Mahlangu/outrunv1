import { test, expect } from "@playwright/test";

test.describe("marketing site", () => {
  test("landing page renders the hero and links to sign-up", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Start Growing.");
    await expect(page.getByRole("link", { name: "Start Now" }).first()).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  test("nav links to sign-in and sign-up", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/sign-in");
    await expect(page.getByRole("link", { name: "Start Now" }).first()).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  for (const path of ["/privacy", "/terms", "/security"]) {
    test(`${path} loads without error`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.ok()).toBe(true);
    });
  }
});
