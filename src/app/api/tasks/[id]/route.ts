import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { captureError } from "@/lib/observability";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { generateCoachFeedback } from "@/lib/growth-partner/coach";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR = "We couldn't update that task right now. Please try again in a moment.";

const updateTaskSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "DISMISSED"], { message: "Choose a valid status." }),
  completionNotes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  }

  const { id } = await params;
  const parsed = await parseJsonBody(request, updateTaskSchema);
  if (parsed.error) return parsed.error;
  const { status, completionNotes } = parsed.data;

  const existing = await prisma.task.findFirst({ where: { id, organizationId: organization.id } });
  if (!existing) {
    return NextResponse.json({ error: "That task could not be found." }, { status: 404 });
  }

  try {
    let task = await prisma.task.update({
      where: { id },
      data: {
        status,
        ownerUserId: existing.ownerUserId ?? session.user.id,
        completionNotes: completionNotes ?? existing.completionNotes,
        completedAt: status === "PENDING" ? null : (existing.completedAt ?? new Date()),
      },
    });

    // docs/outrun/08 "GROWTH MEMORY" — "Recommendation completed.
    // Recommendation ignored." Only log on an actual transition, so
    // re-saving notes on an already-completed task doesn't spam the
    // timeline with duplicate entries.
    if (status !== existing.status) {
      if (status === "COMPLETED") {
        const notes = completionNotes?.trim() ?? "";
        await logEvent(
          organization.id,
          EventType.TASK_COMPLETED,
          `Completed task "${existing.title}".${notes ? ` ${notes}` : ""}`,
        );

        // docs/outrun/10 "AI COACH" — celebrate, explain why it mattered,
        // recommend the next action. Best-effort: generateCoachFeedback
        // never throws, so a missing/failed AI provider never blocks the
        // completion itself, just leaves coachFeedback null.
        const feedback = await generateCoachFeedback(organization.id, {
          title: task.title,
          description: task.description,
          completionNotes: task.completionNotes,
        });
        if (feedback) {
          task = await prisma.task.update({ where: { id }, data: { coachFeedback: feedback } });
        }
      } else if (status === "DISMISSED") {
        await logEvent(
          organization.id,
          EventType.TASK_DISMISSED,
          `Dismissed task "${existing.title}".`,
        );
      }
    }

    return NextResponse.json({ task });
  } catch (error) {
    captureError("tasks.update", error, { organizationId: organization.id, taskId: id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
