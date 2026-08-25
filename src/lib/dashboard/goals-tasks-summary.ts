import { prisma } from "@/lib/prisma";
import type { GoalStatus, TaskStatus } from "@prisma/client";

export type GoalsTasksSummary = {
  goals: { total: number; completed: number; active: number; abandoned: number };
  tasks: { total: number; completed: number; pending: number; dismissed: number };
};

function countByStatus<S extends string>(
  rows: Array<{ status: S; _count: { _all: number } }>,
  status: S,
): number {
  return rows.find((r) => r.status === status)?._count._all ?? 0;
}

// docs/outrun/04 "Mission Control" — a plain roll-up of what's already
// tracked (Goal.status, Task.status), not a new metric. Business Snapshot
// (./business-snapshot.ts) already surfaces one specific active revenue
// goal's progress; this is the completed-vs-open count across all goals
// and all AI-generated growth tasks, so "how much of what Outrun has
// asked of me have I actually done" has one honest answer on the
// dashboard instead of only living on the separate /goals and /tasks
// pages.
export async function getGoalsTasksSummary(organizationId: string): Promise<GoalsTasksSummary> {
  const [goalCounts, taskCounts] = await Promise.all([
    prisma.goal.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
  ]);

  const completedGoals = countByStatus<GoalStatus>(goalCounts, "COMPLETED");
  const activeGoals = countByStatus<GoalStatus>(goalCounts, "ACTIVE");
  const abandonedGoals = countByStatus<GoalStatus>(goalCounts, "ABANDONED");

  const completedTasks = countByStatus<TaskStatus>(taskCounts, "COMPLETED");
  const pendingTasks = countByStatus<TaskStatus>(taskCounts, "PENDING");
  const dismissedTasks = countByStatus<TaskStatus>(taskCounts, "DISMISSED");

  return {
    goals: {
      total: completedGoals + activeGoals + abandonedGoals,
      completed: completedGoals,
      active: activeGoals,
      abandoned: abandonedGoals,
    },
    tasks: {
      total: completedTasks + pendingTasks + dismissedTasks,
      completed: completedTasks,
      pending: pendingTasks,
      dismissed: dismissedTasks,
    },
  };
}
