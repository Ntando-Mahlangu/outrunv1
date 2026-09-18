import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { TasksPageClient } from "@/components/tasks/tasks-page-client";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ taskId?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const { taskId } = await searchParams;

  const tasks = await prisma.task.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return <TasksPageClient initialTasks={tasks} highlightTaskId={taskId} />;
}
