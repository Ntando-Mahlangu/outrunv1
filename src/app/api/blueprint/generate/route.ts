import { NextResponse } from "next/server";
import { after } from "next/server";
import { UsageEventType } from "@prisma/client";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { assertUsageAvailable } from "@/lib/billing/usage";
import { enqueueJob, runJob } from "@/lib/jobs/queue";
import { findLatestForOrg } from "@/lib/repositories/growth-blueprint-repository";
import { UserFacingError, RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";

const GENERIC_ERROR =
  "We couldn't start building your Growth Blueprint right now. Please try again in a moment.";

// The actual generation runs in `after()`, which on Vercel counts against
// this same invocation's execution budget — raise it so a slow AI call
// doesn't get killed mid-generation. Requires a Vercel plan that allows
// it; on Hobby this is capped at 60s regardless. Set to 300 (not 120)
// because the very first Blueprint chains the Second Wow Moment
// (src/lib/onboarding/second-wow.ts — a search, up to 3 research calls,
// and a campaign-with-outreach generation) inside the same job.
export const maxDuration = 300;

export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json(
      { error: "No workspace found for this account." },
      { status: 404 },
    );
  }

  try {
    await checkRateLimit(`ai:${organization.id}`, RATE_LIMITS.AI.limit, RATE_LIMITS.AI.windowSeconds);

    // Idempotency: /blueprint/generating fires this on mount, and React's
    // dev-mode double-effect (or a duplicate tab, or a retried request) can
    // send two POSTs within milliseconds of each other. Without this check,
    // both pass assertUsageAvailable before either has recorded usage,
    // enqueue two jobs, and a Free-tier org — which only gets one Blueprint,
    // ever — has its lifetime allotment burned by a single click before the
    // first generation even finishes. Returning the in-flight job instead
    // makes a duplicate call a no-op rather than a second billable attempt.
    const inFlight = await prisma.job.findFirst({
      where: {
        organizationId: organization.id,
        type: "BLUEPRINT_GENERATION",
        status: { in: ["PENDING", "RUNNING"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (inFlight) {
      return NextResponse.json({ jobId: inFlight.id });
    }

    // Check-only here — the actual generation runs later, asynchronously
    // (see runJob() below), so recording usage happens there, only once
    // it actually succeeds. Recording it here would burn the org's
    // allotment for an attempt that hasn't happened yet, and previously
    // did exactly that whenever generation failed downstream (e.g. a
    // misconfigured AI provider) — see src/lib/jobs/queue.ts.
    await assertUsageAvailable(organization.id, UsageEventType.BLUEPRINT_GENERATION);

    const job = await enqueueJob(organization.id, "BLUEPRINT_GENERATION", {});
    after(() => runJob(job.id));

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof UserFacingError) {
      // Onboarding sends every re-submission here to refresh the Blueprint
      // (see src/app/onboarding/page.tsx), but Free only ever grants one —
      // when an org has already used it, this is never the org's first
      // Blueprint, so the caller (src/app/blueprint/generating/page.tsx)
      // uses this to send the user back to the one they already have
      // instead of dead-ending on an upgrade wall with no way into the
      // rest of the app.
      const existingBlueprint = await findLatestForOrg(organization.id);
      return NextResponse.json(
        { error: error.message, hasExistingBlueprint: Boolean(existingBlueprint) },
        { status: 403 },
      );
    }
    captureError("blueprint.generate", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
