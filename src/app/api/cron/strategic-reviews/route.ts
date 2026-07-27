import { NextRequest, NextResponse } from "next/server";
import { runStrategicReviewTick } from "@/lib/growth-partner/strategic-review";
import { RateLimitError } from "@/lib/errors";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";

/**
 * Called on a schedule by an external cron (see DEPLOYMENT.md), same
 * pattern as src/app/api/cron/autonomous-send — fails closed without
 * CRON_SECRET configured rather than being an unauthenticated endpoint
 * anyone could call to burn AI usage across every workspace.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Strategic Reviews are not configured." }, { status: 501 });
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
    const result = await runStrategicReviewTick();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    captureError("cron.strategic-reviews", error);
    return NextResponse.json({ error: "Tick failed." }, { status: 500 });
  }
}
