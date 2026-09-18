import { describe, it, expect } from "vitest";
import { toStoredFields } from "./content";
import type {
  LongFormContentData,
  FaqPageContentData,
  ShortFormContentData,
  OptionsContentData,
} from "./content-schema";

describe("toStoredFields", () => {
  it("maps a long-form type straight onto title/metaDescription/body, with no content JSON", () => {
    const data: LongFormContentData = {
      title: "5 Ways to Grow",
      metaDescription: "A guide to growth.",
      body: "Full article body.",
    };
    for (const type of ["BLOG_POST", "LANDING_PAGE", "SERVICE_PAGE"] as const) {
      const fields = toStoredFields(type, data);
      expect(fields).toEqual({
        title: "5 Ways to Grow",
        metaDescription: "A guide to growth.",
        body: "Full article body.",
        content: null,
      });
    }
  });

  it("stores an FAQ page's questions/answers in content, leaving body null", () => {
    const data: FaqPageContentData = {
      title: "Frequently Asked Questions",
      metaDescription: "Answers to common questions.",
      faqs: [{ question: "Q1?", answer: "A1." }],
    };
    const fields = toStoredFields("FAQ_PAGE", data);
    expect(fields.title).toBe("Frequently Asked Questions");
    expect(fields.body).toBeNull();
    expect(fields.content).toEqual({ faqs: [{ question: "Q1?", answer: "A1." }] });
  });

  it("stores a feature description's title/body but never a metaDescription", () => {
    const data: ShortFormContentData = { title: "Live Chat", body: "Talk to us in real time." };
    const fields = toStoredFields("FEATURE_DESCRIPTION", data);
    expect(fields).toEqual({
      title: "Live Chat",
      metaDescription: null,
      body: "Talk to us in real time.",
      content: null,
    });
  });

  it("stores options-only types (meta title/description, CTA) entirely in content, with no title/body", () => {
    const data: OptionsContentData = { options: ["Option A", "Option B", "Option C"] };
    for (const type of ["META_TITLE", "META_DESCRIPTION", "CALL_TO_ACTION"] as const) {
      const fields = toStoredFields(type, data);
      expect(fields).toEqual({
        title: null,
        metaDescription: null,
        body: null,
        content: { options: ["Option A", "Option B", "Option C"] },
      });
    }
  });
});
