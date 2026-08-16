import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { eventLabel } from "@/lib/memory/event-labels";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function MemoryPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const events = await prisma.event.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <SplitHeading
            as="h1"
            text="AI Memory"
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Everything Outrun has learned and done for {organization.name}.
          </p>
        </div>
        <a
          href="/api/memory/export"
          className="text-sm text-[var(--color-accent-text)] hover:underline"
        >
          Export my data
        </a>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Growth Timeline
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Nothing has happened yet — actions you take across Outrun will
            show up here as they happen.
          </p>
        ) : (
          <ul className="space-y-4">
            {events.map((event) => (
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
    </div>
  );
}
