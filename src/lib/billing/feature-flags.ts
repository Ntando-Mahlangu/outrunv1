import type { PlanTier } from "@prisma/client";

// docs/outrun/14 "FEATURE GATING" — "Every feature checks plan access.
// Never hard-code plan names. Use feature flags." Flag keys mirror the
// doc's own dot-namespaced examples so a plan/pricing change only ever
// means editing the tier list below, never touching a call site's logic.
export const FEATURE_FLAGS = {
  SEO_ENGINE: "seo.engine",
  GROWTH_BLUEPRINT_EXPORT: "growth_blueprint.export",
  TEAM_WORKSPACES: "team.workspaces",
  PROSPECTS_EXPORT: "prospects.export",
  API_ACCESS: "api.access",
  AUTONOMOUS_SENDING: "campaigns.autonomous_sending",
} as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export type FlagConfig = {
  tiers: PlanTier[];
  // docs/outrun/12/15 "FEATURE FLAGS" — "Instant Rollback"/"Instant
  // Disable": a single switch to pull a feature for everyone regardless of
  // plan or rollout percentage, without a deploy. Defaults to enabled so
  // every existing flag behaves exactly as before this field existed.
  enabled?: boolean;
  // "Gradual Rollout"/"Percentage Rollout": what fraction of orgs that
  // already pass the tier check actually get the feature, 0-100. Defaults
  // to 100 (fully rolled out) — every existing flag is unaffected until a
  // flag is deliberately given a lower value during a staged rollout.
  rolloutPercentage?: number;
};

// Every paid tier now has a real Paddle price (src/lib/billing/plans.ts —
// Growth/Unlimited read their price ID from an env var, same as Starter),
// so gating behind GROWTH/UNLIMITED no longer makes a flag permanently
// unreachable. TEAM_WORKSPACES is deliberately open to every tier (matching
// the same call already made in src/lib/teams/invite.ts's doc comment)
// rather than locked behind a plan nobody can buy. API_ACCESS matches
// docs/outrun/14's own plan copy — "API Access (Limited)" is listed under
// Growth, not Starter.
const FLAG_CONFIG: Record<FeatureFlag, FlagConfig> = {
  [FEATURE_FLAGS.SEO_ENGINE]: { tiers: ["STARTER", "GROWTH", "UNLIMITED"] },
  [FEATURE_FLAGS.GROWTH_BLUEPRINT_EXPORT]: { tiers: ["STARTER", "GROWTH", "UNLIMITED"] },
  [FEATURE_FLAGS.TEAM_WORKSPACES]: { tiers: ["FREE", "STARTER", "GROWTH", "UNLIMITED"] },
  [FEATURE_FLAGS.PROSPECTS_EXPORT]: { tiers: ["STARTER", "GROWTH", "UNLIMITED"] },
  [FEATURE_FLAGS.API_ACCESS]: { tiers: ["GROWTH", "UNLIMITED"] },
  // docs/outrun/07 pitches Autonomous Growth Mode (real unsupervised
  // sending) as an Unlimited-plan differentiator.
  [FEATURE_FLAGS.AUTONOMOUS_SENDING]: { tiers: ["UNLIMITED"] },
};

/**
 * Deterministic string -> [0, 100) bucket, so the same organization always
 * gets the same rollout decision for a given flag rather than a coin flip
 * on every request. Not cryptographic — just needs to distribute IDs
 * evenly across buckets. FNV-1a-style: fast, no dependency, good enough
 * distribution for a rollout percentage.
 */
export function hashToPercentageBucket(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % 100;
}

/**
 * The actual gating decision, factored out from `isFeatureEnabled` so it's
 * testable against arbitrary configs — not just the real `FLAG_CONFIG`
 * map, where every flag currently defaults to a 100% rollout.
 */
export function evaluateFlag(
  config: FlagConfig,
  planTier: PlanTier,
  bucketKey: string,
): boolean {
  if (config.enabled === false) return false;
  if (!config.tiers.includes(planTier)) return false;

  const rolloutPercentage = config.rolloutPercentage ?? 100;
  if (rolloutPercentage >= 100) return true;
  if (rolloutPercentage <= 0) return false;
  return hashToPercentageBucket(bucketKey) < rolloutPercentage;
}

export function isFeatureEnabled(
  planTier: PlanTier,
  flag: FeatureFlag,
  organizationId: string,
): boolean {
  return evaluateFlag(FLAG_CONFIG[flag], planTier, `${flag}:${organizationId}`);
}
