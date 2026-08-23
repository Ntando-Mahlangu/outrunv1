import { createHash } from "node:crypto";
import type { RawCompanyResult } from "@/lib/leads/types";

// docs/outrun/06 "LEAD DATA PROVIDERS" — a manual side door into the same
// pipeline every CompanyDataProvider feeds (scoreCompany, upsertFromSearchResult).
// Exists so a list gathered outside Outrun — a manually-run Google Maps
// export tool, a spreadsheet from a trade association, anything — can be
// brought in without Outrun itself doing any scraping (see the ToS
// discussion that led here: scraping Google Maps directly would risk
// account bans and legal exposure Outrun shouldn't take on for its users).

const MAX_ROWS = 500;

// Normalized (lowercased, non-alphanumeric stripped) header aliases a
// real export is likely to use — covers Outrun's own CSV export headers
// (export-csv.ts) plus common variants from other tools/spreadsheets.
const HEADER_ALIASES: Record<string, keyof RawCompanyResult> = {
  name: "name",
  businessname: "name",
  companyname: "name",
  company: "name",
  category: "category",
  type: "category",
  businesstype: "category",
  website: "website",
  url: "website",
  site: "website",
  phone: "phone",
  phonenumber: "phone",
  telephone: "phone",
  displayphone: "phone",
  address: "formattedAddress",
  formattedaddress: "formattedAddress",
  fulladdress: "formattedAddress",
  location: "formattedAddress",
  rating: "rating",
  stars: "rating",
  reviewcount: "reviewCount",
  reviews: "reviewCount",
  numreviews: "reviewCount",
  userratingcount: "reviewCount",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Exported for testing — pure RFC 4180 parser: quoted fields, embedded
 * commas/newlines, and doubled-up escaped quotes. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function sourceIdFor(name: string, phone: string | null, address: string | null): string {
  return createHash("sha256")
    .update(`${name}|${phone ?? ""}|${address ?? ""}`.toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
}

export type ImportCsvResult = {
  companies: RawCompanyResult[];
  skipped: string[];
};

/** Parses and validates a CSV file's text into RawCompanyResult rows ready
 * for the same scoreCompany/upsertFromSearchResult pipeline every search
 * provider feeds. Never throws on bad data — an unusable row is skipped
 * and explained in `skipped`, matching this app's "no fabricated results,
 * degrade honestly" rule rather than failing the whole import over one
 * bad line. */
export function parseCompaniesCsv(text: string): ImportCsvResult {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { companies: [], skipped: ["The file is empty."] };
  }

  const [headerRow, ...dataRows] = rows;
  const columns = headerRow!.map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? null);

  if (!columns.includes("name")) {
    return {
      companies: [],
      skipped: ['The file needs a "Name" column so each row can be identified.'],
    };
  }

  const skipped: string[] = [];
  const companies: RawCompanyResult[] = [];
  const limitedRows = dataRows.slice(0, MAX_ROWS);
  if (dataRows.length > MAX_ROWS) {
    skipped.push(`Only the first ${MAX_ROWS} rows were imported — the file had ${dataRows.length}.`);
  }

  limitedRows.forEach((cells, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-indexing
    const values: Partial<Record<keyof RawCompanyResult, string>> = {};
    columns.forEach((field, colIndex) => {
      if (field) values[field] = cells[colIndex]?.trim();
    });

    const name = values.name?.trim();
    if (!name) {
      skipped.push(`Row ${rowNumber}: no name — skipped.`);
      return;
    }

    const rating = values.rating ? Number.parseFloat(values.rating) : null;
    const reviewCount = values.reviewCount ? Number.parseInt(values.reviewCount, 10) : null;
    const phone = values.phone || null;
    const formattedAddress = values.formattedAddress || null;

    companies.push({
      source: "csv_import",
      sourceId: sourceIdFor(name, phone, formattedAddress),
      name,
      category: values.category || null,
      website: values.website || null,
      phone,
      formattedAddress,
      rating: rating != null && rating >= 0 && rating <= 5 ? rating : null,
      reviewCount: reviewCount != null && reviewCount >= 0 ? reviewCount : null,
    });
  });

  return { companies, skipped };
}
