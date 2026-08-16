import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SplitHeading } from "@/components/motion/split-heading";

const PERIOD_TONE = {
  WEEKLY: "accent",
  MONTHLY: "medium",
  QUARTERLY: "high",
} as const;

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Nothing notable this period.</p>
      ) : (
        <ul className="list-inside list-disc space-y-1 text-sm text-[var(--color-text-secondary)]">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function StrategicReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const { id } = await params;
  const review = await prisma.strategicReview.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!review) notFound();

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/growth-partner/reviews" className="text-sm text-[var(--color-accent-text)] hover:underline">
        ← Strategic Reviews
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={PERIOD_TONE[review.period]}>{review.period}</Badge>
            <SplitHeading
              as="h1"
              text={`${new Date(review.periodStart).toLocaleDateString()} – ${new Date(review.periodEnd).toLocaleDateString()}`}
              className="text-xl font-light tracking-tight text-[var(--color-text-primary)]"
            />
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Generated {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>
        <a
          href={`/api/growth-partner/reviews/${review.id}/export`}
          className="text-sm text-[var(--color-accent-text)] hover:underline"
        >
          Export PDF
        </a>
      </div>

      <ListSection title="Achievements" items={review.achievements as string[]} />
      <ListSection title="Missed Opportunities" items={review.missedOpportunities as string[]} />
      <ListSection title="Risks" items={review.risks as string[]} />
      <ListSection title="Key Learnings" items={review.keyLearnings as string[]} />
      <ListSection title="Recommended Priorities" items={review.recommendedPriorities as string[]} />

      <Card>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
          Next Growth Strategy
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">{review.nextGrowthStrategy}</p>
      </Card>
    </div>
  );
}
