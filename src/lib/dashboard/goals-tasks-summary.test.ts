import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getGoalsTasksSummary } from "./goals-tasks-summary";

describe("getGoalsTasksSummary (integration)", () => {
  let organizationId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Goals Tasks Summary Test Org" } });
    organizationId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("returns all-zero counts with nothing seeded", async () => {
    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary).toEqual({
      goals: { total: 0, completed: 0, active: 0, abandoned: 0 },
      tasks: { total: 0, completed: 0, pending: 0, dismissed: 0 },
    });
  });

  it("counts goals and tasks by status", async () => {
    await prisma.goal.createMany({
      data: [
        { organizationId, title: "Goal A", status: "COMPLETED" },
        { organizationId, title: "Goal B", status: "ACTIVE" },
        { organizationId, title: "Goal C", status: "ACTIVE" },
        { organizationId, title: "Goal D", status: "ABANDONED" },
      ],
    });
    await prisma.task.createMany({
      data: [
        { organizationId, title: "Task A", description: "d", impact: "High", status: "COMPLETED" },
        { organizationId, title: "Task B", description: "d", impact: "Medium", status: "PENDING" },
        { organizationId, title: "Task C", description: "d", impact: "Low", status: "PENDING" },
        { organizationId, title: "Task D", description: "d", impact: "Low", status: "DISMISSED" },
      ],
    });

    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary).toEqual({
      goals: { total: 4, completed: 1, active: 2, abandoned: 1 },
      tasks: { total: 4, completed: 1, pending: 2, dismissed: 1 },
    });
  });

  it("scopes counts to the given organization only", async () => {
    const otherOrg = await prisma.organization.create({ data: { name: "Other Org" } });
    await prisma.goal.create({ data: { organizationId: otherOrg.id, title: "Other Goal", status: "COMPLETED" } });

    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary.goals.total).toBe(0);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });
});
