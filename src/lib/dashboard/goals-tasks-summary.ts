import { prisma } from "@/lib/prisma";
import type { Goal, GoalStatus, Task, TaskImpact, TaskStatus } from "@prisma/client";

export type ActiveGoalSummary = {
  id: string;
  title: string;
  targetDate: Date | null;
  progressPercent: number | null;
  isOverdue: boolean;
};

export type NextTaskSummary = {
  id: string;
  title: string;
  impact: TaskImpact;
  dueDate: Date | null;
};

export type GoalsTasksSummary = {
  goals: {
    total: number;
    completed: number;
    active: number;
    abandoned: number;
    completionPercent: number;
    upcoming: ActiveGoalSummary[];
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    dismissed: number;
    completionPercent: number;
    next: NextTaskSummary | null;
  };
};

function countByStatus<S extends string>(
  rows: Array<{ status: S; _count: { _all: number } }>,
  status: S,
): number {
  return rows.find((r) => r.status === status)?._count._all ?? 0;
}

function completionPercent(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function goalProgress(goal: Goal): ActiveGoalSummary {
  const progressPercent =
    goal.targetValue != null && goal.targetValue > 0 && goal.currentValue != null
      ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
      : null;
  return {
    id: goal.id,
    title: goal.title,
    targetDate: goal.targetDate,
    progressPercent,
    isOverdue: goal.targetDate != null && goal.targetDate.getTime() < referenceNow(),
  };
}

const IMPACT_RANK: Record<TaskImpact, number> = { High: 0, Medium: 1, Low: 2 };

function pickNextTask(tasks: Task[]): NextTaskSummary | null {
  const [top] = [...tasks].sort((a, b) => {
    if (a.impact !== b.impact) return IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact];
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return top ? { id: top.id, title: top.title, impact: top.impact, dueDate: top.dueDate } : null;
}

// A plain function (not Date.now() inline) so callers stay pure where React's
// purity rule cares — same pattern as daysAgo() in growth-partner/opportunity-feed.ts.
function referenceNow(): number {
  return Date.now();
}

// docs/outrun/04 "Mission Control" — a plain roll-up of what's already
// tracked (Goal.status, Task.status), not a new metric. Business Snapshot
// (./business-snapshot.ts) already surfaces one specific active revenue
// goal's raw progress; this is the completed-vs-open count across all
// goals and all AI-generated growth tasks, plus enough detail on what's
// still open (upcoming goals sorted soonest-first, the single next task
// worth doing) that the card is a real answer to "am I actually making
// progress," not just a static tally.
export async function getGoalsTasksSummary(organizationId: string): Promise<GoalsTasksSummary> {
  const [goalCounts, taskCounts, activeGoals, pendingTasks] = await Promise.all([
    prisma.goal.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
    prisma.goal.findMany({
      where: { organizationId, status: "ACTIVE" },
      orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 3,
    }),
    prisma.task.findMany({
      where: { organizationId, status: "PENDING" },
    }),
  ]);

  const completedGoals = countByStatus<GoalStatus>(goalCounts, "COMPLETED");
  const activeGoalCount = countByStatus<GoalStatus>(goalCounts, "ACTIVE");
  const abandonedGoals = countByStatus<GoalStatus>(goalCounts, "ABANDONED");
  const goalsTotal = completedGoals + activeGoalCount + abandonedGoals;

  const completedTasks = countByStatus<TaskStatus>(taskCounts, "COMPLETED");
  const pendingTasksCount = countByStatus<TaskStatus>(taskCounts, "PENDING");
  const dismissedTasks = countByStatus<TaskStatus>(taskCounts, "DISMISSED");
  const tasksTotal = completedTasks + pendingTasksCount + dismissedTasks;

  return {
    goals: {
      total: goalsTotal,
      completed: completedGoals,
      active: activeGoalCount,
      abandoned: abandonedGoals,
      completionPercent: completionPercent(completedGoals, goalsTotal),
      upcoming: activeGoals.map(goalProgress),
    },
    tasks: {
      total: tasksTotal,
      completed: completedTasks,
      pending: pendingTasksCount,
      dismissed: dismissedTasks,
      completionPercent: completionPercent(completedTasks, tasksTotal),
      next: pickNextTask(pendingTasks),
    },
  };
}
