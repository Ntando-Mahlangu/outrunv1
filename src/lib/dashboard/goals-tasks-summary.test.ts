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
      goals: { total: 0, completed: 0, active: 0, abandoned: 0, completionPercent: 0, upcoming: [] },
      tasks: { total: 0, completed: 0, pending: 0, dismissed: 0, completionPercent: 0, next: null },
    });
  });

  it("counts goals and tasks by status and computes completion percent", async () => {
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
    expect(summary.goals).toMatchObject({ total: 4, completed: 1, active: 2, abandoned: 1, completionPercent: 25 });
    expect(summary.tasks).toMatchObject({ total: 4, completed: 1, pending: 2, dismissed: 1, completionPercent: 25 });
  });

  it("scopes counts to the given organization only", async () => {
    const otherOrg = await prisma.organization.create({ data: { name: "Other Org" } });
    await prisma.goal.create({ data: { organizationId: otherOrg.id, title: "Other Goal", status: "COMPLETED" } });

    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary.goals.total).toBe(0);

    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it("computes progress percent for a goal with numeric target/current values", async () => {
    await prisma.goal.create({
      data: { organizationId, title: "Revenue", status: "ACTIVE", targetValue: 10000, currentValue: 2500 },
    });
    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary.goals.upcoming).toHaveLength(1);
    expect(summary.goals.upcoming[0]).toMatchObject({ title: "Revenue", progressPercent: 25, isOverdue: false });
  });

  it("leaves progressPercent null when a goal has no numeric target", async () => {
    await prisma.goal.create({ data: { organizationId, title: "Qualitative Goal", status: "ACTIVE" } });
    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary.goals.upcoming[0]?.progressPercent).toBeNull();
  });

  it("flags a goal past its target date as overdue", async () => {
    await prisma.goal.create({
      data: {
        organizationId,
        title: "Overdue Goal",
        status: "ACTIVE",
        targetDate: new Date("2020-01-01"),
      },
    });
    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary.goals.upcoming[0]).toMatchObject({ title: "Overdue Goal", isOverdue: true });
  });

  it("sorts upcoming goals soonest target date first, caps at 3", async () => {
    await prisma.goal.createMany({
      data: [
        { organizationId, title: "No date", status: "ACTIVE" },
        { organizationId, title: "Far", status: "ACTIVE", targetDate: new Date("2030-01-01") },
        { organizationId, title: "Near", status: "ACTIVE", targetDate: new Date("2027-01-01") },
        { organizationId, title: "Extra", status: "ACTIVE", targetDate: new Date("2031-01-01") },
      ],
    });
    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary.goals.upcoming.map((g) => g.title)).toEqual(["Near", "Far", "Extra"]);
  });

  it("picks the highest-impact pending task as next", async () => {
    await prisma.task.createMany({
      data: [
        { organizationId, title: "Low impact", description: "d", impact: "Low", status: "PENDING" },
        { organizationId, title: "High impact", description: "d", impact: "High", status: "PENDING" },
        { organizationId, title: "Medium impact", description: "d", impact: "Medium", status: "PENDING" },
      ],
    });
    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary.tasks.next?.title).toBe("High impact");
  });

  it("breaks ties between same-impact tasks by earliest due date", async () => {
    await prisma.task.createMany({
      data: [
        {
          organizationId,
          title: "Due later",
          description: "d",
          impact: "High",
          status: "PENDING",
          dueDate: new Date("2027-06-01"),
        },
        {
          organizationId,
          title: "Due sooner",
          description: "d",
          impact: "High",
          status: "PENDING",
          dueDate: new Date("2027-01-01"),
        },
      ],
    });
    const summary = await getGoalsTasksSummary(organizationId);
    expect(summary.tasks.next?.title).toBe("Due sooner");
  });
});
