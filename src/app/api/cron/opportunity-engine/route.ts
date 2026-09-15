import { NextRequest, NextResponse } from "next/server";
import { runOpportunityDetectionTick } from "@/lib/opportunities/detect";
import { RateLimitError } from "@/lib/errors";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";

/**
 * Called on a schedule by an external cron (see DEPLOYMENT.md), same
 * pattern as src/app/api/cron/strategic-reviews — fails closed without
 * CRON_SECRET configured rather than being an unauthenticated endpoint
 * anyone could call to sweep every workspace.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "The Opportunity Engine sweep is not configured." }, { status: 501 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await checkRateLimit(
      `webhook:${getClientIp(request)}`,
      RATE_LIMITS.WEBHOOK.limit,
      RATE_LIMITS.WEBHOOK.windowSeconds,
    );
    const result = await runOpportunityDetectionTick();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    captureError("cron.opportunity-engine", error);
    return NextResponse.json({ error: "Tick failed." }, { status: 500 });
  }
}
