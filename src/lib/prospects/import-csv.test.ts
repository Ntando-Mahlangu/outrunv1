import { describe, it, expect } from "vitest";
import { parseCsvRows, parseCompaniesCsv } from "./import-csv";

describe("parseCsvRows", () => {
  it("splits a simple comma-separated file into rows", () => {
    expect(parseCsvRows("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas and embedded quotes", () => {
    const csv = 'name,address\n"Acme, Inc.","123 ""Main"" St"';
    expect(parseCsvRows(csv)).toEqual([
      ["name", "address"],
      ["Acme, Inc.", '123 "Main" St'],
    ]);
  });

  it("handles a quoted field containing a newline", () => {
    const csv = 'name,notes\nAcme,"Line one\nLine two"';
    expect(parseCsvRows(csv)).toEqual([
      ["name", "notes"],
      ["Acme", "Line one\nLine two"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsvRows("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCompaniesCsv", () => {
  it("maps a well-formed CSV into RawCompanyResult rows", () => {
    const csv = [
      "Name,Category,Website,Phone,Address,Rating,Review Count",
      "Acme Plumbing,Plumber,https://acme.example.com,555-0100,\"123 Main St, Austin, TX\",4.5,25",
    ].join("\n");

    const { companies, skipped } = parseCompaniesCsv(csv);
    expect(skipped).toEqual([]);
    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({
      source: "csv_import",
      name: "Acme Plumbing",
      category: "Plumber",
      website: "https://acme.example.com",
      phone: "555-0100",
      formattedAddress: "123 Main St, Austin, TX",
      rating: 4.5,
      reviewCount: 25,
    });
    expect(companies[0]!.sourceId).toHaveLength(32);
  });

  it("recognizes flexible header aliases", () => {
    const csv = ["Business Name,Full Address,Reviews", "Beta HVAC,456 Oak Ave,10"].join("\n");
    const { companies } = parseCompaniesCsv(csv);
    expect(companies[0]).toMatchObject({
      name: "Beta HVAC",
      formattedAddress: "456 Oak Ave",
      reviewCount: 10,
    });
  });

  it("skips rows with no name and reports why", () => {
    const csv = ["Name,Phone", ",555-0100", "Beta HVAC,555-0200"].join("\n");
    const { companies, skipped } = parseCompaniesCsv(csv);
    expect(companies).toHaveLength(1);
    expect(skipped).toEqual(["Row 2: no name — skipped."]);
  });

  it("rejects a file with no Name column", () => {
    const csv = ["Phone,Address", "555-0100,123 Main St"].join("\n");
    const { companies, skipped } = parseCompaniesCsv(csv);
    expect(companies).toEqual([]);
    expect(skipped[0]).toMatch(/Name/);
  });

  it("rejects an empty file", () => {
    const { companies, skipped } = parseCompaniesCsv("");
    expect(companies).toEqual([]);
    expect(skipped).toEqual(["The file is empty."]);
  });

  it("ignores an out-of-range rating rather than failing the row", () => {
    const csv = ["Name,Rating", "Acme,9.9"].join("\n");
    const { companies } = parseCompaniesCsv(csv);
    expect(companies[0]!.rating).toBeNull();
  });

  it("generates a stable sourceId for the same name/phone/address", () => {
    const csv = "Name,Phone\nAcme Plumbing,555-0100";
    const first = parseCompaniesCsv(csv).companies[0]!.sourceId;
    const second = parseCompaniesCsv(csv).companies[0]!.sourceId;
    expect(first).toBe(second);
  });
});
