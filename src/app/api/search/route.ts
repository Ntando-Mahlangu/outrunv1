import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { classifySearchIntent } from "@/lib/search/intent";
import { findBestCampaign } from "@/lib/search/best-campaign";

export type SearchResult = { type: string; label: string; sublabel: string | null; href: string };

const PER_TYPE_LIMIT = 5;

// docs/outrun/04 "GLOBAL SEARCH" — "Search should understand intent."
// classifySearchIntent routes a query one of three ways before any DB
// lookup runs:
//   - "ask"/command-shaped queries ("Why did replies drop?", "Generate
//     emails.") go to the AI Coach, which is already grounded in full
//     business memory (docs/outrun/10) — substring-matching those
//     against company/campaign names would just return nothing useful.
//     Deliberately NOT calling the AI on every keystroke here: this
//     route only returns a link to /growth-partner with the question
//     attached, so the AI only actually runs once the user commits to
//     it (see the growth-partner page's `ask` param).
//   - "best-campaign" is a real, deterministic ranking off actual
//     send/reply data (src/lib/search/best-campaign.ts) — no AI needed.
//   - everything else is a plain record lookup, same as before.
export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) return NextResponse.json({ error: "No workspace found." }, { status: 404 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const intent = classifySearchIntent(q);

  if (intent.kind === "ask") {
    const results: SearchResult[] = [
      {
        type: "Ask the AI Coach",
        label: `Ask: "${intent.question}"`,
        sublabel: "Uses everything Outrun knows about your business",
        href: `/growth-partner?ask=${encodeURIComponent(intent.question)}`,
      },
    ];
    return NextResponse.json({ results });
  }

  if (intent.kind === "best-campaign") {
    const best = await findBestCampaign(organization.id);
    if (best) {
      const results: SearchResult[] = [
        {
          type: "Campaign",
          label: `${best.name} — best reply rate`,
          sublabel: `${best.replyRatePercent}% reply rate across ${best.sentCount} sent`,
          href: `/campaigns/${best.id}`,
        },
      ];
      return NextResponse.json({ results });
    }
    // Not enough send/reply data to rank anything yet — fall through to
    // a plain lookup rather than returning an empty result for a query
    // that might also just be a literal campaign name.
  }

  const [companies, campaigns, tasks, goals] = await Promise.all([
    prisma.company.findMany({
      where: { organizationId: organization.id, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, category: true },
      take: PER_TYPE_LIMIT,
    }),
    prisma.campaign.findMany({
      where: { organizationId: organization.id, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, status: true },
      take: PER_TYPE_LIMIT,
    }),
    prisma.task.findMany({
      where: { organizationId: organization.id, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, status: true },
      take: PER_TYPE_LIMIT,
    }),
    prisma.goal.findMany({
      where: { organizationId: organization.id, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, status: true },
      take: PER_TYPE_LIMIT,
    }),
  ]);

  const results: SearchResult[] = [
    ...companies.map((c) => ({
      type: "Prospect",
      label: c.name,
      sublabel: c.category,
      href: `/prospects/${c.id}`,
    })),
    ...campaigns.map((c) => ({
      type: "Campaign",
      label: c.name,
      sublabel: c.status,
      href: `/campaigns/${c.id}`,
    })),
    ...tasks.map((t) => ({
      type: "Task",
      label: t.title,
      sublabel: t.status,
      href: `/tasks`,
    })),
    ...goals.map((g) => ({
      type: "Goal",
      label: g.title,
      sublabel: g.status,
      href: `/goals`,
    })),
  ];

  return NextResponse.json({ results });
}
