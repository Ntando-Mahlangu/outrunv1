/**
 * True only for http:/https: URLs. Every place a stored string is rendered
 * as a clickable `href` (not just typed to `string`) needs this check —
 * React does not sanitize dangerous URL schemes (`javascript:`, `data:`,
 * ...) in attribute values the way it auto-escapes text content, so a
 * stored `javascript:...` value reaching an `<a href>` unchecked executes
 * on click. Guards both the write side (CSV import, src/lib/prospects/import-csv.ts)
 * and the render side (src/app/(app)/prospects/[id]/page.tsx) so any future
 * write path into the same field is covered too.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
