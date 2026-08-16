import { UsageEventType, type Job, type JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/observability";
import { UserFacingError } from "@/lib/errors";
import { recordUsage } from "@/lib/billing/usage";
import { generateGrowthBlueprint } from "@/lib/growth-blueprint/generate";
import { analyzeSEO } from "@/lib/seo/analyze";
import { createCampaign } from "@/lib/campaigns/create";
import { createTasksFromBlueprint } from "@/lib/tasks/generate-from-blueprint";
import { createNotification, NotificationType } from "@/lib/notifications/create-notification";
import { generateSecondWow } from "@/lib/onboarding/second-wow";
import * as growthBlueprintRepository from "@/lib/repositories/growth-blueprint-repository";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";
import type { CampaignStrategyData } from "@/lib/campaigns/strategy-schema";

export type CampaignGenerationPayload = {
  name: string;
  objective: string;
  companyIds: string[];
  abTest?: boolean;
  strategy?: CampaignStrategyData;
  audienceSource?: string;
};

type JobPayloads = {
  BLUEPRINT_GENERATION: Record<string, never>;
  SEO_ANALYSIS: Record<string, never>;
  CAMPAIGN_GENERATION: CampaignGenerationPayload;
  SECOND_WOW_GENERATION: Record<string, never>;
};

/**
 * docs/outrun/11-13 "BACKGROUND JOBS" — enqueues a row and returns
 * immediately; the caller is responsible for actually running it (via
 * Next's `after()` in the route handler, right after this call), so the
 * HTTP response doesn't wait on the AI work.
 */
export async function enqueueJob<T extends JobType>(
  organizationId: string,
  type: T,
  payload: JobPayloads[T],
): Promise<Job> {
  return prisma.job.create({
    data: { organizationId, type, payload, status: "PENDING" },
  });
}

async function runHandler(job: Job): Promise<string | null> {
  switch (job.type) {
    case "BLUEPRINT_GENERATION": {
      const blueprint = await generateGrowthBlueprint(job.organizationId);
      // Only charged against the org's plan allotment once generation has
      // actually produced a Blueprint (see assertUsageAvailable() in
      // src/app/api/blueprint/generate/route.ts, which only checked the
      // limit before this ran) — a failed attempt no longer costs a
      // Free-tier user their one lifetime credit.
      await recordUsage(job.organizationId, UsageEventType.BLUEPRINT_GENERATION);
      await createTasksFromBlueprint(blueprint);
      await createNotification(
        job.organizationId,
        NotificationType.BLUEPRINT_READY,
        "Growth Blueprint ready",
        `Version ${blueprint.version} of your Growth Blueprint has finished generating.`,
        "/blueprint",
      );

      // docs/outrun/03 "SECOND WOW MOMENT" — only on the very first
      // Blueprint ever, never a regeneration, so this never silently
      // creates a second auto-campaign each time the user refreshes their
      // Blueprint. Chained (not fire-and-forget) so the client's poll on
      // this job only resolves once the second-wow work is also done —
      // by the time the user lands on /blueprint, it's already there. A
      // failure here must never fail the Blueprint job itself, since the
      // Blueprint already succeeded.
      if (blueprint.version === 1) {
        try {
          const secondWowJob = await enqueueJob(job.organizationId, "SECOND_WOW_GENERATION", {});
          await runJob(secondWowJob.id);
        } catch (error) {
          captureError("jobs.second-wow-chain", error, { organizationId: job.organizationId });
        }
      }

      return blueprint.id;
    }
    case "SEO_ANALYSIS": {
      const analysis = await analyzeSEO(job.organizationId);
      await createNotification(
        job.organizationId,
        NotificationType.SEO_ANALYSIS_READY,
        "SEO analysis ready",
        "Your website's SEO analysis has finished.",
        "/seo",
      );
      return analysis.id;
    }
    case "CAMPAIGN_GENERATION": {
      const payload = job.payload as unknown as CampaignGenerationPayload;
      const result = await createCampaign(job.organizationId, payload);
      await createNotification(
        job.organizationId,
        NotificationType.CAMPAIGN_FINISHED,
        "Campaign ready",
        `"${payload.name}" has finished generating.`,
        `/campaigns/${result.campaignId}`,
      );
      return result.campaignId;
    }
    case "SECOND_WOW_GENERATION": {
      const latest = await growthBlueprintRepository.findLatestIcpForOrg(job.organizationId);
      const icp = latest?.idealCustomerProfile as GrowthBlueprintData["idealCustomerProfile"] | undefined;
      if (!icp) return null;

      const result = await generateSecondWow(job.organizationId, icp);
      return result.campaignId;
    }
  }
}

/**
 * Executes a previously-enqueued job. Safe to call from `after()` (fire
 * and forget — nothing awaits its return value) or from a cron sweep
 * that retries jobs stuck in PENDING (e.g. the invocation that enqueued
 * them crashed before calling this). No-ops if the job has already
 * moved past PENDING, so a job is never run twice.
 */
export async function runJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const resultId = await runHandler(job);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "SUCCEEDED", completedAt: new Date(), resultId },
    });
  } catch (error) {
    captureError("jobs.run", error, { jobId, type: job.type, organizationId: job.organizationId });
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        // Only a UserFacingError's message is safe to show verbatim
        // (src/lib/errors.ts) — anything else (config issues, provider
        // outages, unexpected exceptions) must never reach the client,
        // since job.errorMessage is returned as-is by /api/jobs/[id] and
        // rendered directly (e.g. src/components/growth-blueprint/blueprint-actions.tsx).
        errorMessage:
          error instanceof UserFacingError
            ? error.message
            : "Something went wrong on our end. Please try again in a moment.",
      },
    });
  }
}

const STUCK_JOB_MINUTES = 10;

// docs/outrun/15 "MONITORING" — "Track: ... Queue Length ... Alert when
// thresholds are exceeded." This app has no dedicated metrics/alerting
// service (see DEPLOYMENT.md's Monitoring section for what's delegated to
// the host vs. what's actually checked in code); this is the one queue in
// the system, so its depth is the one metric worth a real threshold check.
// 20 simultaneously PENDING/RUNNING jobs is well above what a single-tenant
// background-job volume (Blueprint/SEO/campaign generation) should ever
// reach under normal use — that many almost always means jobs are piling
// up faster than they're processed (e.g. the AI provider is down and
// causing repeated failures) rather than genuine legitimate load.
export const QUEUE_DEPTH_ALERT_THRESHOLD = 20;

export function shouldAlertForQueueDepth(depth: number): boolean {
  return depth >= QUEUE_DEPTH_ALERT_THRESHOLD;
}

/**
 * Entry point for the scheduled sweep (src/app/api/cron/job-queue) —
 * catches jobs that never got picked up by `after()` (e.g. the
 * serverless instance that enqueued them was recycled before the
 * post-response callback ran) and jobs stuck in RUNNING past a
 * reasonable ceiling (the invocation running them died mid-flight). Also
 * reports current queue depth so the cron route can alert on it.
 */
export async function sweepStuckJobs() {
  const cutoff = new Date(Date.now() - STUCK_JOB_MINUTES * 60 * 1000);

  const stuck = await prisma.job.findMany({
    where: {
      OR: [
        { status: "PENDING", createdAt: { lt: cutoff } },
        { status: "RUNNING", startedAt: { lt: cutoff } },
      ],
    },
  });

  for (const job of stuck) {
    await prisma.job.update({ where: { id: job.id }, data: { status: "PENDING" } });
    await runJob(job.id);
  }

  const queueDepth = await prisma.job.count({
    where: { status: { in: ["PENDING", "RUNNING"] } },
  });

  return { swept: stuck.length, queueDepth, queueDepthAlert: shouldAlertForQueueDepth(queueDepth) };
}
