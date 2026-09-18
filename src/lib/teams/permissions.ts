import type { MembershipRole } from "@prisma/client";

// docs/outrun/14 "PERMISSIONS" — Owner: everything; Admin: workspace, users,
// campaigns, billing. Manager/Member/Viewer never manage team membership.
const TEAM_MANAGERS: MembershipRole[] = ["OWNER", "ADMIN"];

export function canManageTeam(role: MembershipRole): boolean {
  return TEAM_MANAGERS.includes(role);
}

// docs/outrun/14 "PERMISSIONS" lists Campaigns under both Admin's and
// Manager's permissions — Member ("Assigned Work") and Viewer ("Read
// Only") are deliberately excluded. Gates creating/pausing/duplicating
// campaigns and editing brand voice; NOT autonomous sending, which is a
// materially more sensitive unsupervised action — see canSendAutonomously.
const CAMPAIGN_MANAGERS: MembershipRole[] = ["OWNER", "ADMIN", "MANAGER"];

export function canManageCampaigns(role: MembershipRole): boolean {
  return CAMPAIGN_MANAGERS.includes(role);
}

// Stricter than canManageCampaigns: doc 14's permission table doesn't grant
// Manager real unsupervised-send authority the way it grants them ordinary
// campaign management, and Autonomous Growth Mode sends without a human
// reviewing each message — same Owner/Admin bar as billing and API keys.
export function canSendAutonomously(role: MembershipRole): boolean {
  return TEAM_MANAGERS.includes(role);
}

// Same Owner/Admin set — gates requesting a refund (docs/outrun/14
// "REFUNDS"), a real financial action, not just viewing plan info.
export function canManageBilling(role: MembershipRole): boolean {
  return TEAM_MANAGERS.includes(role);
}

// Same Owner/Admin set — gates issuing/revoking API keys (docs/outrun/11
// "Audit API access"), a credential-issuance action, not just viewing.
export function canManageApiKeys(role: MembershipRole): boolean {
  return TEAM_MANAGERS.includes(role);
}

// Same Owner/Admin set — gates registering/removing webhook endpoints
// (docs/outrun/11 "WEBHOOK SYSTEM"), another credential-issuance action
// (each endpoint gets its own signing secret), same bar as API keys.
export function canManageWebhooks(role: MembershipRole): boolean {
  return TEAM_MANAGERS.includes(role);
}

// docs/outrun/14 "PERMISSIONS" — Owner: everything; Admin's own list
// ("Manage Workspace, Billing, Users, Campaigns") stops short of
// destroying the workspace itself. Owner-only, unlike every other
// TEAM_MANAGERS check above.
export function canDeleteOrganization(role: MembershipRole): boolean {
  return role === "OWNER";
}
