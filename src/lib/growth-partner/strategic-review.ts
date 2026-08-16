import { prisma } from "@/lib/prisma";
import type { ReviewPeriod } from "@prisma/client";
import { getAIProvider } from "@/lib/ai";
import { getBusinessContext, formatBusinessContext } from "@/lib/memory/context";
import { getRisksAndOpportunities } from "./risks";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { createNotification, NotificationType } from "@/lib/notifications/create-notification";
import { captureError } from "@/lib/observability";
import {
  strategicReviewSchema,
  strategicReviewJsonSchema,
  type StrategicReviewData,
} from "./strategic-review-schema";

const PERIOD_DAYS: Record<ReviewPeriod, number> = {
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
};

function periodWindow(period: ReviewPeriod, now: Date = new Date()) {
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000);
  return { periodStart, periodEnd };
}

/**
 * A plain factual summary of what actually happened in [periodStart,
 * periodEnd) — the AI only ever reasons over this and the business's
 * overall context, never over anything it has to guess at.
 */
async function buildPeriodSummary(organizationId: string, periodStart: Date, periodEnd: Date) {
  const [events, blueprintAtStart, blueprintAtEnd, sentMessages, currentSignals] = await Promise.all([
    prisma.event.findMany({
      where: { organizationId, createdAt: { gte: periodStart, lt: periodEnd } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.growthBlueprint.findFirst({
      where: { organizationId, createdAt: { lt: periodStart } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.growthBlueprint.findFirst({
      where: { organizationId, createdAt: { lt: periodEnd } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.outreachMessage.findMany({
      where: {
        company: { organizationId },
        sendStatus: "SENT",
        sentAt: { gte: periodStart, lt: periodEnd },
      },
      select: { gotReply: true },
    }),
    getRisksAndOpportunities(organizationId),
  ]);

  const lines: string[] = [];
  lines.push(`Period: ${periodStart.toDateString()} to ${periodEnd.toDateString()}`);
  lines.push(`Events logged in this period: ${events.length}`);
  for (const e of events.slice(0, 30)) {
    lines.push(`- ${e.summary}`);
  }

  if (blueprintAtStart && blueprintAtEnd) {
    lines.push(
      `Growth Score at start of period: ${blueprintAtStart.growthScore}. At end of period: ${blueprintAtEnd.growthScore}. Change: ${blueprintAtEnd.growthScore - blueprintAtStart.growthScore}.`,
    );
  } else if (blueprintAtEnd) {
    lines.push(
      `Current Growth Score: ${blueprintAtEnd.growthScore} (no earlier Blueprint exists to compare against).`,
    );
  } else {
    lines.push("No Growth Blueprint exists yet.");
  }

  lines.push(
    `Outreach sent in this period: ${sentMessages.length}, replies: ${sentMessages.filter((m) => m.gotReply).length}.`,
  );

  if (currentSignals.length > 0) {
    lines.push("Risks/gaps observed as of this review:");
    for (const s of currentSignals) lines.push(`- [${s.severity}] ${s.title}: ${s.reason}`);
  } else {
    lines.push("No obvious risks detected as of this review.");
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Outrun's AI Growth Partner generating a Strategic Review (docs/outrun/10
"STRATEGIC REVIEWS"). You are given a factual summary of what actually
happened in this specific period, plus the business's overall context.

Rules you must follow (non-negotiable):
- achievements, missedOpportunities, risks, and keyLearnings must be
  drawn ONLY from the period summary and business context given below —
  never invent an event, metric, or trend that isn't there.
- If nothing meaningful happened in a section (e.g. no risks worth
  flagging), return an empty array for it rather than inventing filler.
- recommendedPriorities and nextGrowthStrategy should be genuinely
  forward-looking and specific to this business, grounded in what the
  period summary shows worked or didn't.
- Never present an estimate or trend as a guaranteed outcome.

Period summary (factual, not AI-generated):
{{PERIOD_SUMMARY}}

Overall business context:
{{CONTEXT}}`;

export async function generateStrategicReview(organizationId: string, period: ReviewPeriod) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { businessProfile: true },
  });
  if (!organization.businessProfile) {
    throw new UserFacingError("Finish Business Discovery before generating a Strategic Review.");
  }

  const { periodStart, periodEnd } = periodWindow(period);
  const [periodSummary, context] = await Promise.all([
    buildPeriodSummary(organizationId, periodStart, periodEnd),
    getBusinessContext(organizationId),
  ]);

  const ai = getAIProvider();
  const data = await ai.generateObject<StrategicReviewData>({
    system: SYSTEM_PROMPT.replace("{{PERIOD_SUMMARY}}", periodSummary).replace(
      "{{CONTEXT}}",
      formatBusinessContext(context),
    ),
    messages: [{ role: "user", content: `Generate the ${period.toLowerCase()} strategic review.` }],
    schema: strategicReviewSchema,
    jsonSchema: strategicReviewJsonSchema,
    toolName: "strategic_review",
  });

  const review = await prisma.strategicReview.create({
    data: {
      organizationId,
      period,
      periodStart,
      periodEnd,
      achievements: data.achievements,
      missedOpportunities: data.missedOpportunities,
      risks: data.risks,
      keyLearnings: data.keyLearnings,
      recommendedPriorities: data.recommendedPriorities,
      nextGrowthStrategy: data.nextGrowthStrategy,
    },
  });

  await logEvent(
    organizationId,
    EventType.STRATEGIC_REVIEW_GENERATED,
    `Generated a ${period.toLowerCase()} strategic review.`,
  );
  await createNotification(
    organizationId,
    NotificationType.STRATEGIC_REVIEW_READY,
    "Strategic Review ready",
    `Your ${period.toLowerCase()} strategic review has finished generating.`,
    "/growth-partner/reviews",
  );

  return review;
}

/**
 * Entry point for the scheduled job (src/app/api/cron/strategic-reviews).
 * For every organization with a completed Business Profile, generates
 * each period's review once enough time has passed since its last one —
 * "Generate automatically" (docs/outrun/10) without the owner needing to
 * remember to ask.
 */
export async function runStrategicReviewTick() {
  const organizations = await prisma.organization.findMany({
    // deletedAt: null — this cron has no session and queries Organization
    // directly, so without this a deleted workspace would keep burning
    // real AI generation cost producing reviews nobody can see.
    where: { businessProfile: { isNot: null }, deletedAt: null },
    select: { id: true },
  });

  const results = { organizationsChecked: organizations.length, generated: 0, failed: 0 };
  const periods: ReviewPeriod[] = ["WEEKLY", "MONTHLY", "QUARTERLY"];

  for (const org of organizations) {
    for (const period of periods) {
      const last = await prisma.strategicReview.findFirst({
        where: { organizationId: org.id, period },
        orderBy: { createdAt: "desc" },
      });
      const dueMs = PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
      const isDue = !last || Date.now() - last.createdAt.getTime() >= dueMs;
      if (!isDue) continue;

      try {
        await generateStrategicReview(org.id, period);
        results.generated += 1;
      } catch (error) {
        results.failed += 1;
        captureError("growth-partner.strategic-review.tick", error, {
          organizationId: org.id,
          period,
        });
      }
    }
  }

  return results;
}
