export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const value = candidate.status ?? candidate.statusCode;
  return typeof value === "number" ? value : null;
}

/**
 * True for network failures, request timeouts, and HTTP responses
 * carrying a retryable status (429 or 5xx). A plain 4xx (bad input,
 * unauthorized, not found) is never retryable — it will fail the same
 * way every time, and retrying would just make the caller wait longer
 * for an identical error.
 */
function isRetryableByDefault(error: unknown): boolean {
  if (error instanceof TypeError) return true; // fetch-level network failure
  // A manual AbortController.abort() (no reason given) throws "AbortError".
  // AbortSignal.timeout(ms) — what every fetch call in this codebase
  // actually uses — throws "TimeoutError" instead once the timer elapses
  // (that's the DOMException name the spec gives it, not "AbortError").
  // Without this second name, a timeout NEVER retried at all: it fell
  // through every check below to "not retryable" and failed immediately
  // on the very first attempt, indistinguishable from a genuine 4xx.
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return true;
  }
  const status = extractStatus(error);
  if (status == null) return false;
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Exponential backoff with jitter for transient failures on external
 * calls (docs/outrun/11 "ERROR HANDLING"). Used for HTTP clients this
 * app owns directly (Google Places, Resend) that have no retry logic of
 * their own — the Anthropic SDK already retries internally, so it isn't
 * wrapped here (stacking two independent retry loops would multiply
 * worst-case latency without adding real reliability).
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const isRetryable = options.isRetryable ?? isRetryableByDefault;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryable(error)) {
        throw error;
      }
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(delay * (0.5 + Math.random() * 0.5));
    }
  }
  throw lastError;
}

/** Attaches an HTTP status code to an Error so withRetry's default
 * retryability check (and callers logging the failure) can see it. */
export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
