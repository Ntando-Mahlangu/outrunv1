import { prisma } from "@/lib/prisma";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SENT_FOR_REPLY_RATE = 4;
const MIN_RATE_DELTA_POINTS = 5;

/**
 * docs/outrun/10 "HOME SCREEN" — "Biggest Win This Week". Computed
 * directly from real send/reply data and Blueprint score history, never
 * an AI-generated claim — if nothing meets the bar for a real, notable
 * win, this returns null and the briefing says so honestly rather than
 * inventing one.
 */
export async function getBiggestWinThisWeek(organizationId: string): Promise<string | null> {
  const now = Date.now();
  const weekAgo = new Date(now - WEEK_MS);
  const twoWeeksAgo = new Date(now - 2 * WEEK_MS);

  const [thisWeekSent, lastWeekSent] = await Promise.all([
    prisma.outreachMessage.findMany({
      where: { company: { organizationId }, sendStatus: "SENT", sentAt: { gte: weekAgo } },
      select: { gotReply: true },
    }),
    prisma.outreachMessage.findMany({
      where: {
        company: { organizationId },
        sendStatus: "SENT",
        sentAt: { gte: twoWeeksAgo, lt: weekAgo },
      },
      select: { gotReply: true },
    }),
  ]);

  if (
    thisWeekSent.length >= MIN_SENT_FOR_REPLY_RATE &&
    lastWeekSent.length >= MIN_SENT_FOR_REPLY_RATE
  ) {
    const thisRate = thisWeekSent.filter((m) => m.gotReply).length / thisWeekSent.length;
    const lastRate = lastWeekSent.filter((m) => m.gotReply).length / lastWeekSent.length;
    const deltaPoints = Math.round((thisRate - lastRate) * 100);
    if (deltaPoints >= MIN_RATE_DELTA_POINTS) {
      return `Reply rate increased by ${deltaPoints} percentage points (${Math.round(lastRate * 100)}% → ${Math.round(thisRate * 100)}%).`;
    }
  }

  const versions = await prisma.growthBlueprint.findMany({
    where: { organizationId },
    orderBy: { version: "desc" },
    take: 2,
    select: { growthScore: true, createdAt: true },
  });
  const [latest, previous] = versions;
  if (latest && previous && latest.createdAt >= weekAgo && latest.growthScore > previous.growthScore) {
    return `Growth Score increased by ${latest.growthScore - previous.growthScore} points to ${latest.growthScore}.`;
  }

  const outreachSentThisWeek = await prisma.outreachMessage.count({
    where: { company: { organizationId }, sendStatus: "SENT", sentAt: { gte: weekAgo } },
  });
  if (outreachSentThisWeek > 0) {
    return `Sent ${outreachSentThisWeek} outreach message${outreachSentThisWeek === 1 ? "" : "s"} this week.`;
  }

  return null;
}
