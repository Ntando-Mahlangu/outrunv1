import { describe, it, expect } from "vitest";
import { withRetry, HttpError } from "./retry";

describe("withRetry", () => {
  it("retries a transient failure and eventually succeeds", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new HttpError("boom", 503);
        return "ok";
      },
      { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 5 },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("gives up after maxAttempts on a persistent failure", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new HttpError("still down", 500);
        },
        { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 },
      ),
    ).rejects.toThrow("still down");
    expect(attempts).toBe(3);
  });

  it("never retries a 4xx error", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new HttpError("bad request", 400);
        },
        { maxAttempts: 5, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("bad request");
    expect(attempts).toBe(1);
  });

  it("retries a 429", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new HttpError("rate limited", 429);
        },
        { maxAttempts: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow();
    expect(attempts).toBe(2);
  });

  it("retries an AbortSignal.timeout() TimeoutError, not just AbortError", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw new DOMException("signal timed out", "TimeoutError");
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5 },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("honors a custom isRetryable predicate", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("custom error");
        },
        { maxAttempts: 3, baseDelayMs: 1, isRetryable: () => true },
      ),
    ).rejects.toThrow();
    expect(attempts).toBe(3);
  });
});
