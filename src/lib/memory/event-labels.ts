import type { EventType } from "@prisma/client";

// Shared between the AI Memory timeline (src/app/(app)/memory/page.tsx)
// and the dashboard's Recent Activity widget so both ever display the
// same label for the same event type.
export const EVENT_LABELS: Record<EventType, string> = {
  BLUEPRINT_GENERATED: "Growth Blueprint",
  COMPANY_SEARCHED: "Search",
  COMPANY_RESEARCHED: "Research",
  OUTREACH_GENERATED: "Outreach",
  OUTREACH_SENT: "Outreach Sent",
  FOLLOW_UP_SEQUENCE_GENERATED: "Follow-Up",
  CALL_SCRIPT_GENERATED: "Call Script",
  CALL_LOGGED: "Call Logged",
  COMPANY_IMPORTED: "CSV Import",
  LEAD_LIST_CREATED: "Lead List",
  REFUND_REQUESTED: "Billing",
  CAMPAIGN_CREATED: "Campaign",
  CAMPAIGN_TEMPLATE_SAVED: "Campaign Template",
  PATTERN_IDENTIFIED: "Improvement Loop",
  SEO_ANALYZED: "SEO",
  SEO_CONTENT_GENERATED: "SEO Content",
  TEAM_MEMBER_INVITED: "Team",
  TEAM_MEMBER_JOINED: "Team",
  WHATIF_SIMULATED: "What-If",
  DECISION_REQUESTED: "Decision",
  AUTONOMOUS_SEND_RUN: "Autonomous Send",
  AUTONOMOUS_SEND_PAUSED: "Autonomous Send Paused",
  STRATEGIC_REVIEW_GENERATED: "Growth Review",
  GOAL_CREATED: "Goal",
  GOAL_ACHIEVED: "Goal Achieved",
  TASK_COMPLETED: "Task Completed",
  TASK_DISMISSED: "Task Dismissed",
  RECOMMENDATION_RATED: "Feedback",
};

export function eventLabel(type: EventType): string {
  return EVENT_LABELS[type] ?? type;
}
