import { describe, it, expect } from "vitest";
import type { Company } from "@prisma/client";
import { companiesToCsv } from "./export-csv";

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: "1",
    organizationId: "org-1",
    source: "google_places",
    sourceId: "src-1",
    name: "Acme Plumbing",
    category: "Plumber",
    website: "https://acme.example.com",
    phone: "555-0100",
    contactEmail: null,
    formattedAddress: "123 Main St, Austin, TX",
    rating: 4.5,
    reviewCount: 25,
    fitScore: 88,
    fitReason: "Strong industry match.",
    confidenceScore: 70,
    confidenceReason: "Has a website.",
    research: null,
    callScript: null,
    isSaved: false,
    assignedToUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("companiesToCsv", () => {
  it("includes a header row and one row per company", () => {
    const csv = companiesToCsv([company(), company({ id: "2", name: "Beta HVAC" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "Name,Category,Website,Phone,Contact Email,Address,Rating,Review Count,Fit Score,Fit Reason,Confidence Score,Confidence Reason,Saved,Added",
    );
    expect(lines[1]).toContain("Acme Plumbing");
    expect(lines[2]).toContain("Beta HVAC");
  });

  it("renders null fields as empty strings, not the literal 'null'", () => {
    const csv = companiesToCsv([company({ category: null, rating: null, contactEmail: null })]);
    expect(csv).not.toContain("null");
  });

  it("quotes fields containing commas", () => {
    const csv = companiesToCsv([company({ formattedAddress: "123 Main St, Suite 400, Austin, TX" })]);
    expect(csv).toContain('"123 Main St, Suite 400, Austin, TX"');
  });

  it("escapes embedded quotes by doubling them", () => {
    const csv = companiesToCsv([company({ name: 'Bob\'s "Best" Plumbing' })]);
    expect(csv).toContain('"Bob\'s ""Best"" Plumbing"');
  });

  it("returns just the header row for an empty list", () => {
    const csv = companiesToCsv([]);
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
