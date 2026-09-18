import { describe, it, expect } from "vitest";
import { buildVariantAssignment } from "./create";
import { VARIANT_LABELS } from "@/lib/prospects/outreach";

describe("buildVariantAssignment", () => {
  it("returns exactly `count` labels, every one a valid variant", () => {
    const assignment = buildVariantAssignment(11);
    expect(assignment).toHaveLength(11);
    for (const label of assignment) {
      expect(VARIANT_LABELS).toContain(label);
    }
  });

  it("splits as evenly as possible across all three angles, not just two", () => {
    const assignment = buildVariantAssignment(30);
    const counts = VARIANT_LABELS.map((label) => assignment.filter((l) => l === label).length);
    expect(counts).toEqual([10, 10, 10]);
  });

  it("keeps counts within 1 of each other when the total doesn't divide evenly", () => {
    const assignment = buildVariantAssignment(10);
    const counts = VARIANT_LABELS.map((label) => assignment.filter((l) => l === label).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("does not always assign the same variant to the same position (it's shuffled, not a fixed i%N)", () => {
    // Run many times; with a fixed i%N split, position 0 would always be
    // "A". A real shuffle should show more than one label at position 0
    // across enough trials.
    const seenAtPositionZero = new Set(
      Array.from({ length: 50 }, () => buildVariantAssignment(9)[0]),
    );
    expect(seenAtPositionZero.size).toBeGreaterThan(1);
  });

  it("returns an empty assignment for zero companies", () => {
    expect(buildVariantAssignment(0)).toEqual([]);
  });
});
