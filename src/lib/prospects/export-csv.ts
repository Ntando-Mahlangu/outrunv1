import type { Company } from "@prisma/client";

const COLUMNS: { header: string; value: (c: Company) => string }[] = [
  { header: "Name", value: (c) => c.name },
  { header: "Category", value: (c) => c.category ?? "" },
  { header: "Website", value: (c) => c.website ?? "" },
  { header: "Phone", value: (c) => c.phone ?? "" },
  { header: "Contact Email", value: (c) => c.contactEmail ?? "" },
  { header: "Address", value: (c) => c.formattedAddress ?? "" },
  { header: "Rating", value: (c) => (c.rating != null ? String(c.rating) : "") },
  { header: "Review Count", value: (c) => (c.reviewCount != null ? String(c.reviewCount) : "") },
  { header: "Fit Score", value: (c) => (c.fitScore != null ? String(c.fitScore) : "") },
  { header: "Fit Reason", value: (c) => c.fitReason ?? "" },
  { header: "Confidence Score", value: (c) => (c.confidenceScore != null ? String(c.confidenceScore) : "") },
  { header: "Confidence Reason", value: (c) => c.confidenceReason ?? "" },
  { header: "Saved", value: (c) => (c.isSaved ? "Yes" : "No") },
  { header: "Added", value: (c) => c.createdAt.toISOString() },
];

// CSV/formula injection (CWE-1236) mitigation — a field beginning with =,
// +, -, @, or a tab is a live formula the moment this file is opened in
// Excel/Sheets/LibreOffice. Applied here at export, not at write time, so
// the app's own UI never shows a mutated value for a legitimate name that
// happens to start with one of these characters (e.g. "-Automotive
// Repair") — it only matters once data leaves the app as a spreadsheet
// file, and every column goes through this, not just ones a specific
// write path (like CSV import) happens to touch.
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t"]);

function neutralizeFormulaPrefix(value: string): string {
  return value.length > 0 && FORMULA_TRIGGER_CHARS.has(value[0]!) ? `'${value}` : value;
}

// RFC 4180 — quote any field containing a comma, quote, or newline;
// double up embedded quotes.
function escapeCsvField(value: string): string {
  const safe = neutralizeFormulaPrefix(value);
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function companiesToCsv(companies: Company[]): string {
  const rows = [
    COLUMNS.map((c) => c.header),
    ...companies.map((company) => COLUMNS.map((c) => escapeCsvField(c.value(company)))),
  ];
  return rows.map((row) => row.join(",")).join("\r\n");
}
