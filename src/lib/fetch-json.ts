// A server error page (e.g. a platform gateway timeout) can return HTML
// instead of JSON. Parsing that with res.json() throws a raw SyntaxError
// that would otherwise surface verbatim to the user — this keeps that
// failure mode falling back to the same friendly message as a normal
// API error instead of leaking a parser exception.
export async function readJsonSafely(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
