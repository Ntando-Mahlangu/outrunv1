import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { findLatestForOrg } from "@/lib/repositories/growth-blueprint-repository";
import { BlueprintPending } from "@/components/dashboard/blueprint-pending";
import { getTodaysMission, getMissionActionHref } from "@/lib/dashboard/mission";
import { getBusinessHealth, type HealthCategory } from "@/lib/growth-partner/health";
import { getBiggestWinThisWeek } from "@/lib/growth-partner/weekly-win";
import { getRisksAndOpportunities } from "@/lib/growth-partner/risks";
import { getBusinessSnapshot } from "@/lib/dashboard/business-snapshot";
import { getGoalsTasksSummary } from "@/lib/dashboard/goals-tasks-summary";
import { getInFlightBlueprintJob, getRecentFailedBlueprintJob } from "@/lib/dashboard/blueprint-job-status";
import { getCampaignOverview } from "@/lib/dashboard/campaign-overview";
import { getGrowthStreaks } from "@/lib/dashboard/streaks";
import { getUpcomingTasks, getRecentNotifications } from "@/lib/dashboard/right-sidebar-data";
import { eventLabel } from "@/lib/memory/event-labels";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ImpactBadge, Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/growth-blueprint/score-gauge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EvidenceToggle } from "@/components/dashboard/evidence-toggle";
import { CampaignOverviewWidget } from "@/components/dashboard/campaign-overview-widget";
import { RightSidebar } from "@/components/dashboard/right-sidebar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";
import { CountUp } from "@/components/motion/count-up";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";

function formatTrend(trend: number | null): string | null {
  if (trend === null || trend === 0) return null;
  return trend > 0 ? `+${trend}` : `${trend}`;
}

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

const QUICK_ACTIONS = [
  { href: "/prospects", label: "Find Companies" },
  { href: "/campaigns/new", label: "Launch Campaign" },
  { href: "/seo", label: "Analyse Website" },
  { href: "/growth-partner/reviews", label: "Run Weekly Review" },
  { href: "/blueprint", label: "Update Growth Blueprint" },
  { href: "/tasks", label: "Growth Tasks" },
  { href: "/goals", label: "Goals" },
];

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");
  if (!organization.businessProfile) redirect("/onboarding");

  const blueprint = await findLatestForOrg(organization.id);
  if (!blueprint) {
    const [inFlightJob, lastFailedJob] = await Promise.all([
      getInFlightBlueprintJob(organization.id),
      getRecentFailedBlueprintJob(organization.id),
    ]);
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md">
          <BlueprintPending
            hasInFlightJob={Boolean(inFlightJob)}
            lastFailedError={lastFailedJob?.errorMessage}
          />
        </div>
      </div>
    );
  }

  const mission = getTodaysMission(blueprint);
  const allOpportunities = blueprint.opportunities as GrowthBlueprintData["opportunities"];
  const opportunities = allOpportunities.slice(0, 3);

  const [
    health,
    biggestWin,
    risks,
    snapshot,
    goalsTasksSummary,
    campaignOverview,
    streaks,
    upcomingTasks,
    notifications,
    recentEvents,
  ] = await Promise.all([
    getBusinessHealth(organization.id),
    getBiggestWinThisWeek(organization.id),
    getRisksAndOpportunities(organization.id),
    getBusinessSnapshot(organization.id),
    getGoalsTasksSummary(organization.id),
    getCampaignOverview(organization.id),
    getGrowthStreaks(organization.id),
    getUpcomingTasks(organization.id, 5),
    getRecentNotifications(organization.id, 5),
    prisma.event.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  const healthTrendLabel = health ? formatTrend(health.overallTrend) : null;

  const firstName = session.user.name.split(" ")[0];
  const today = new Date();

  const topSignal = risks[0] ?? null;
  const assistantTeaser = topSignal ? `${topSignal.title} — ${topSignal.reason}` : null;

  const lowestHealthCategory: HealthCategory | null = health
    ? health.categories.reduce<HealthCategory | null>(
        (lowest, c) => (lowest === null || c.score < lowest.score ? c : lowest),
        null,
      )
    : null;
  const growthTip = lowestHealthCategory
    ? { category: lowestHealthCategory.category, tip: lowestHealthCategory.fastestImprovement }
    : null;

  return (
    <div className="flex gap-8">
      <RevealGroup className="min-w-0 flex-1 space-y-8" stagger={0.1}>
        <RevealItem>
          <SplitHeading
            as="h1"
            text={`${greeting(today)}, ${firstName}.`}
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Here&apos;s what will help {organization.name} grow today · {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {streaks.growthStreakDays > 0 && (
            <p className="mt-2 text-sm text-[var(--color-accent-text)]">
              {streaks.growthStreakDays} day{streaks.growthStreakDays === 1 ? "" : "s"} in a row
              taking action in Outrun.
            </p>
          )}
        </RevealItem>

        {mission && (
          <RevealItem>
          <Card className="border-[var(--color-accent)]/40">
            <p className="text-xs uppercase tracking-wide text-[var(--color-accent-text)]">
              Today&apos;s Priority
            </p>
            <h2 className="mt-2 text-xl font-light text-[var(--color-text-primary)]">
              {mission.action}
            </h2>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)]">
              {mission.estimatedTime && (
                <span>
                  <span className="text-[var(--color-text-muted)]">Estimated time: </span>
                  {mission.estimatedTime}
                </span>
              )}
              {mission.confidence != null && (
                <span>
                  <span className="text-[var(--color-text-muted)]">Confidence: </span>
                  {mission.confidence}%
                </span>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <ImpactBadge level={mission.expectedImpact} label={`${mission.expectedImpact} impact`} />
            </div>

            <div className="mt-4">
              <EvidenceToggle reason={mission.reason} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-4">
              {health && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Business Health
                  </p>
                  <p className="text-sm text-[var(--color-text-primary)]">
                    <CountUp value={health.overall} suffix="/100" />
                    {healthTrendLabel && (
                      <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                        ({healthTrendLabel})
                      </span>
                    )}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  New Opportunities
                </p>
                <p className="text-sm text-[var(--color-text-primary)]">{allOpportunities.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  Potential Risks
                </p>
                <p className="text-sm text-[var(--color-text-primary)]">{risks.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  Biggest Win This Week
                </p>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {biggestWin ?? "Nothing major to report yet"}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <Magnetic strength={0.15} className="inline-block">
                <Link
                  href={getMissionActionHref(mission)}
                  className={cn(buttonVariants({ size: "lg" }))}
                >
                  Start Today&apos;s Mission
                </Link>
              </Magnetic>
            </div>
          </Card>
          </RevealItem>
        )}

        <RevealItem className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <Card className="flex flex-col items-center justify-center">
            <ScoreGauge score={blueprint.growthScore} label="Growth Score" />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
              Business Health Score
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {health?.categories.map((c) => {
                const trendLabel = formatTrend(c.trend);
                return (
                  <div
                    key={c.category}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {c.category}
                      </span>
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {c.score}
                        {trendLabel && (
                          <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                            ({trendLabel})
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{c.status}</p>
                    {c.mainIssue && (
                      <p className="mt-1 text-xs text-[var(--color-warning)]">
                        Main issue: {c.mainIssue}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Fastest improvement: {c.fastestImprovement}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </RevealItem>

        <RevealItem>
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Business Snapshot
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Revenue Goal
              </p>
              <p className="text-sm text-[var(--color-text-primary)]">
                {snapshot.revenueGoal
                  ? `${snapshot.revenueGoal.currentValue.toLocaleString()} / ${snapshot.revenueGoal.targetValue.toLocaleString()}`
                  : "Not set — add one on Goals"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Campaigns Running
              </p>
              <p className="text-sm text-[var(--color-text-primary)]">{snapshot.campaignsRunning}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Meetings Booked
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">Not tracked yet</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Reply Rate
              </p>
              <p className="text-sm text-[var(--color-text-primary)]">
                {snapshot.replyRate != null ? `${snapshot.replyRate}%` : "No outreach sent yet"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Positive Replies
              </p>
              <p className="text-sm text-[var(--color-text-primary)]">{snapshot.positiveReplies}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Customers Won
              </p>
              <p className="text-sm text-[var(--color-text-primary)]">{snapshot.customersWon}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Pipeline Value
              </p>
              {snapshot.pipelineValue ? (
                <>
                  <p className="text-sm text-[var(--color-text-primary)]">
                    <CountUp value={snapshot.pipelineValue.estimate} prefix="$" />
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Estimate: {snapshot.pipelineValue.qualifiedCount} qualified lead
                    {snapshot.pipelineValue.qualifiedCount === 1 ? "" : "s"} × $
                    {snapshot.pipelineValue.avgCustomerValue.toLocaleString()} avg deal size
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Not tracked yet — needs an average deal size and at least one Qualified contact
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Plan
              </p>
              <p className="text-sm text-[var(--color-text-primary)]">{organization.planTier}</p>
            </div>
          </div>
        </Card>
        </RevealItem>

        <RevealItem>
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Goals &amp; Tasks
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Goals</p>
                <Link href="/goals" className="text-xs text-[var(--color-accent-text)] hover:underline">
                  View all →
                </Link>
              </div>
              {goalsTasksSummary.goals.total === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  No goals set yet — add one to track progress here.
                </p>
              ) : (
                <>
                  <div className="mt-2 mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">
                      {goalsTasksSummary.goals.active} active
                      {goalsTasksSummary.goals.abandoned > 0 &&
                        ` · ${goalsTasksSummary.goals.abandoned} abandoned`}
                    </span>
                    <span className="tabular-nums text-[var(--color-text-muted)]">
                      {goalsTasksSummary.goals.completed} / {goalsTasksSummary.goals.total} completed
                    </span>
                  </div>
                  <ProgressBar value={goalsTasksSummary.goals.completionPercent} />

                  {goalsTasksSummary.goals.upcoming.length > 0 && (
                    <ul className="mt-4 space-y-3">
                      {goalsTasksSummary.goals.upcoming.map((goal) => (
                        <li key={goal.id}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-[var(--color-text-secondary)]">
                              {goal.title}
                            </span>
                            {goal.targetDate && (
                              <span
                                className={cn(
                                  "shrink-0 tabular-nums",
                                  goal.isOverdue
                                    ? "text-[var(--color-error-text)]"
                                    : "text-[var(--color-text-muted)]",
                                )}
                              >
                                {goal.isOverdue ? "Overdue" : `Due ${goal.targetDate.toLocaleDateString()}`}
                              </span>
                            )}
                          </div>
                          {goal.progressPercent != null && (
                            <div className="mt-1">
                              <ProgressBar value={goal.progressPercent} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Growth Tasks</p>
                <Link href="/tasks" className="text-xs text-[var(--color-accent-text)] hover:underline">
                  View all →
                </Link>
              </div>
              {goalsTasksSummary.tasks.total === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  No tasks yet — they&apos;re generated from your Growth Blueprint.
                </p>
              ) : (
                <>
                  <div className="mt-2 mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">
                      {goalsTasksSummary.tasks.pending} pending
                      {goalsTasksSummary.tasks.dismissed > 0 &&
                        ` · ${goalsTasksSummary.tasks.dismissed} dismissed`}
                    </span>
                    <span className="tabular-nums text-[var(--color-text-muted)]">
                      {goalsTasksSummary.tasks.completed} / {goalsTasksSummary.tasks.total} completed
                    </span>
                  </div>
                  <ProgressBar value={goalsTasksSummary.tasks.completionPercent} />

                  {goalsTasksSummary.tasks.next && (
                    <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                          Do next
                        </p>
                        <ImpactBadge
                          level={goalsTasksSummary.tasks.next.impact}
                          label={`${goalsTasksSummary.tasks.next.impact} impact`}
                        />
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                        {goalsTasksSummary.tasks.next.title}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
        </RevealItem>

        <RevealItem>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
              AI Opportunities
            </h2>
            <Link
              href="/blueprint"
              className="text-sm text-[var(--color-accent-text)] hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="space-y-4">
            {opportunities.map((o) => (
              <li
                key={o.title}
                className="border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[var(--color-text-primary)]">{o.title}</p>
                  <ImpactBadge level={o.priority} label={`${o.priority} priority`} />
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {o.description}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        </RevealItem>

        <RevealItem>
          <CampaignOverviewWidget overview={campaignOverview} />
        </RevealItem>

        <RevealItem>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
              Recent Activity
            </h2>
            <Link href="/memory" className="text-sm text-[var(--color-accent-text)] hover:underline">
              View all
            </Link>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Nothing has happened yet — actions you take across Outrun will show up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentEvents.map((event) => (
                <li key={event.id} className="flex items-start gap-3">
                  <Badge tone="accent" className="mt-0.5 shrink-0">
                    {eventLabel(event.type)}
                  </Badge>
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">{event.summary}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {event.createdAt.toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </RevealItem>

        <RevealItem>
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </Card>
        </RevealItem>
      </RevealGroup>

      <RightSidebar
        assistantTeaser={assistantTeaser}
        growthTip={growthTip}
        notifications={notifications}
        upcomingTasks={upcomingTasks}
      />
    </div>
  );
}
