import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UpcomingTask, RecentNotification } from "@/lib/dashboard/right-sidebar-data";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RightSidebar({
  assistantTeaser,
  growthTip,
  notifications,
  upcomingTasks,
}: {
  assistantTeaser: string | null;
  growthTip: { category: string; tip: string } | null;
  notifications: RecentNotification[];
  upcomingTasks: UpcomingTask[];
}) {
  return (
    <aside className="hidden w-80 shrink-0 space-y-6 xl:block">
      <Card>
        <h2 className="text-sm font-medium text-[var(--color-text-primary)]">AI Assistant</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {assistantTeaser ?? "Ask your Growth Partner anything about your business."}
        </p>
        <Link
          href="/growth-partner"
          className="mt-3 inline-block text-sm text-[var(--color-accent-text)] hover:underline"
        >
          Open chat →
        </Link>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
            Recent Notifications
          </h2>
        </div>
        {notifications.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Nothing new yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {notifications.map((n) => (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block hover:underline">
                    <p className="text-sm text-[var(--color-text-primary)]">{n.title}</p>
                  </Link>
                ) : (
                  <p className="text-sm text-[var(--color-text-primary)]">{n.title}</p>
                )}
                <p className="text-xs text-[var(--color-text-muted)]">{timeAgo(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Upcoming Tasks</h2>
          <Link href="/tasks" className="text-xs text-[var(--color-accent-text)] hover:underline">
            View all
          </Link>
        </div>
        {upcomingTasks.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            No open tasks — you&apos;re caught up.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcomingTasks.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-2">
                <span className="text-sm text-[var(--color-text-secondary)]">{t.title}</span>
                <Badge tone={t.impact === "High" ? "high" : t.impact === "Medium" ? "medium" : "low"}>
                  {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : t.impact}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {growthTip && (
        <Card>
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Growth Tip</h2>
          <p className="mt-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            {growthTip.category}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{growthTip.tip}</p>
        </Card>
      )}
    </aside>
  );
}
