import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/observability";
import { assertPubliclyRoutableUrl, ssrfSafeDispatcher } from "@/lib/security/ssrf";
import { decryptSecret, signPayload } from "./crypto";

const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MINUTES = 2;
const DELIVERY_TIMEOUT_MS = 10_000;
const PAYLOAD_VERSION = 1;
const SWEEP_BATCH_SIZE = 100;
// Processed in chunks of this size rather than one at a time — sequential
// processing meant a batch where most deliveries were timing out (each
// eating the full DELIVERY_TIMEOUT_MS) could take SWEEP_BATCH_SIZE *
// DELIVERY_TIMEOUT_MS to finish (worst case ~16 minutes), which is what
// caused the cron to run long enough to get cancelled outright. Endpoints
// are independent HTTP destinations, so nothing here relies on ordering.
const SWEEP_CONCURRENCY = 10;

function nextAttemptDelay(attempts: number): Date {
  const minutes = BASE_BACKOFF_MINUTES * 2 ** (attempts - 1);
  return new Date(Date.now() + minutes * 60_000);
}

async function attemptDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhookEndpoint: true },
  });
  if (!delivery || delivery.status !== "PENDING") return;

  const endpoint = delivery.webhookEndpoint;
  if (!endpoint.enabled) return;

  const attempts = delivery.attempts + 1;
  const body = JSON.stringify({
    version: PAYLOAD_VERSION,
    id: delivery.id,
    type: delivery.eventType,
    createdAt: delivery.createdAt.toISOString(),
    data: delivery.payload,
  });

  try {
    // Re-validated at delivery time (not just at registration) — a URL
    // that resolved publicly when the endpoint was added could now
    // resolve to a private address via DNS rebinding; the dispatcher
    // below also re-checks on every actual connection.
    assertPubliclyRoutableUrl(endpoint.url);
    const secret = decryptSecret(endpoint.secretEncrypted);
    const signature = signPayload(secret, body);

    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Outrun-Signature": signature,
        "X-Outrun-Event": delivery.eventType,
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      // @ts-expect-error -- `dispatcher` is undici-specific and not in the
      // standard fetch() types, but Node's global fetch accepts it.
      dispatcher: ssrfSafeDispatcher,
    });

    if (!res.ok) {
      throw new Error(`Endpoint responded with HTTP ${res.status}.`);
    }

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: "DELIVERED", attempts, deliveredAt: new Date() },
    });
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "Delivery failed.";

    if (attempts >= MAX_ATTEMPTS) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "DEAD_LETTER", attempts, lastError },
      });
      captureError("webhooks.dead-letter", error, {
        endpointId: endpoint.id,
        organizationId: endpoint.organizationId,
        eventType: delivery.eventType,
      });
    } else {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { attempts, lastError, nextAttemptAt: nextAttemptDelay(attempts) },
      });
    }
  }
}

/**
 * docs/outrun/11 "EVENT SYSTEM" — "Every major action generates an
 * event... these events should power future automation." Called from
 * logEvent() (src/lib/memory/log-event.ts), the single existing entry
 * point every meaningful business action already goes through — so
 * every organization with a registered webhook automatically receives
 * every current and future event type, with nothing to wire up at each
 * of logEvent()'s call sites individually.
 *
 * Deliberately only enqueues a PENDING row here — never attempts
 * delivery inline. logEvent() is called from dozens of places across
 * this app, many mid-request; awaiting a third-party URL's response
 * (which could hang for the full DELIVERY_TIMEOUT_MS) inside that path
 * would make an unrelated customer's slow webhook endpoint slow down
 * Outrun's own request handling (doc 11 "Asynchronous where possible").
 * The cron sweep (sweepPendingDeliveries, below) is the only thing that
 * ever actually calls attemptDelivery. Never throws (matches logEvent's
 * own contract): a dispatch failure must never break the business
 * action that triggered it.
 */
export async function dispatchEvent(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId, enabled: true },
      select: { id: true },
    });
    if (endpoints.length === 0) return;

    await prisma.webhookDelivery.createMany({
      data: endpoints.map((endpoint) => ({
        webhookEndpointId: endpoint.id,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      })),
    });
  } catch (error) {
    captureError("webhooks.dispatch", error, { organizationId, eventType });
  }
}

/**
 * Cron-callable sweep (docs/outrun/11 "Retry logic... Dead-letter queue
 * for failures") — retries deliveries whose backoff window has elapsed,
 * same shape as the job queue's own stuck-job sweep (src/lib/jobs/queue.ts).
 */
export async function sweepPendingDeliveries() {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: new Date() },
      // webhookEndpoint.organization.deletedAt: null — this cron has no
      // session and queries WebhookDelivery directly, so without this a
      // deleted workspace's endpoints would keep being retried forever.
      webhookEndpoint: { organization: { deletedAt: null } },
    },
    take: SWEEP_BATCH_SIZE,
  });

  for (let i = 0; i < due.length; i += SWEEP_CONCURRENCY) {
    const chunk = due.slice(i, i + SWEEP_CONCURRENCY);
    await Promise.all(chunk.map((delivery) => attemptDelivery(delivery.id)));
  }

  return { attempted: due.length };
}
