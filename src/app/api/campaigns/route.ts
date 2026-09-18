import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getMembershipFor } from "@/lib/org";
import { enqueueJob, runJob } from "@/lib/jobs/queue";
import { UserFacingError, RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";
import { campaignStrategySchema } from "@/lib/campaigns/strategy-schema";
import { canManageCampaigns } from "@/lib/teams/permissions";

const GENERIC_ERROR =
  "We couldn't start building this campaign right now. Please try again in a moment.";

const createCampaignSchema = z.object({
  name: z
    .string({ message: "Give your campaign a name." })
    .trim()
    .min(1, "Give your campaign a name."),
  objective: z
    .string({ message: "Choose a campaign objective." })
    .trim()
    .min(1, "Choose a campaign objective."),
  companyIds: z
    .array(z.string(), { message: "Select at least one prospect for this campaign." })
    .min(1, "Select at least one prospect for this campaign."),
  abTest: z.boolean().optional(),
  // Reviewed at the Strategy Review step (docs/outrun/07 STEP 3) just
  // before this call — re-validated below rather than trusted outright,
  // and simply regenerated if missing or malformed, so this stays
  // permissive here rather than a hard schema failure.
  strategy: z.unknown().optional(),
  audienceSource: z.string().optional(),
});

// A campaign generates one message per selected company sequentially —
// see src/app/api/blueprint/generate/route.ts for why this is raised.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
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

  const membership = await getMembershipFor(session.user.id, organization.id);
  if (!membership) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }
  if (!canManageCampaigns(membership.role)) {
    return NextResponse.json(
      { error: "You don't have permission to create campaigns in this workspace." },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBody(request, createCampaignSchema);
  if (parsed.error) return parsed.error;
  const { name, objective, companyIds, abTest, strategy, audienceSource } = parsed.data;

  const parsedStrategy = campaignStrategySchema.safeParse(strategy);

  try {
    await checkRateLimit(`ai:${organization.id}`, RATE_LIMITS.AI.limit, RATE_LIMITS.AI.windowSeconds);

    const job = await enqueueJob(organization.id, "CAMPAIGN_GENERATION", {
      name,
      objective,
      companyIds,
      abTest: abTest === true,
      strategy: parsedStrategy.success ? parsedStrategy.data : undefined,
      audienceSource,
    });
    after(() => runJob(job.id));

    return NextResponse.json({ jobId: job.id });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("campaigns.create", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
