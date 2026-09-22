import type { PlanTier } from "@prisma/client";

// docs/outrun/14 — every paid tier's Paddle price ID comes from an env var
// (set once the matching product exists in Paddle's Catalog); the billing
// page (src/app/(app)/billing/page.tsx) renders a real CheckoutButton for
// ANY tier whose paddlePriceId resolves, not just one hardcoded tier — so
// wiring up Growth/Unlimited in production is only ever an env-var change,
// never a code change. A tier left unconfigured still renders an honest
// "not sold yet" card instead of a broken buy button.
export const PLANS: Record<
  PlanTier,
  {
    name: string;
    priceLabel: string;
    features: string[];
    paddlePriceId: string | null;
  }
> = {
  FREE: {
    name: "Free",
    priceLabel: "$0",
    features: [
      "1 Growth Blueprint",
      "10 company searches",
      "5 AI company reports",
      "5 outreach generations",
      "1 campaign",
    ],
    paddlePriceId: null,
  },
  STARTER: {
    name: "Starter",
    priceLabel: "$49/month",
    features: [
      "Unlimited Growth Blueprints",
      "250 company searches",
      "250 AI company reports",
      "500 AI outreach generations",
      "SEO Engine",
      "Growth Blueprint exports",
    ],
    paddlePriceId: process.env.NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID ?? null,
  },
  GROWTH: {
    name: "Growth",
    priceLabel: "$149/month",
    features: [
      "Everything in Starter",
      "More usage across searches, reports, and outreach",
      "Team collaboration",
      "Priority AI processing",
      "Advanced recommendations",
      "Integrations",
      "API Access (Limited)",
      "Priority support",
    ],
    paddlePriceId: process.env.NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID ?? null,
  },
  UNLIMITED: {
    name: "Unlimited",
    priceLabel: "$499/month",
    features: [
      "Unlimited Growth Blueprints",
      "Unlimited prospect searches",
      "Unlimited campaigns and outreach generation",
      "Unlimited saved businesses and workspaces",
      "Unlimited team members",
      "Premium AI models",
      "Priority infrastructure",
      "API access",
      "Dedicated onboarding",
    ],
    paddlePriceId: process.env.NEXT_PUBLIC_PADDLE_UNLIMITED_PRICE_ID ?? null,
  },
};

export function planLabel(tier: PlanTier): string {
  return PLANS[tier]?.name ?? tier;
}

// The one place that defines "has a paid subscription" — every other
// call site should check this instead of comparing `planTier === "FREE"`
// directly, so a future tier still counts as paid without needing a
// second edit (docs/outrun/14 "FEATURE GATING" — "Never hard-code plan
// names").
export function isPaidPlan(tier: PlanTier): boolean {
  return tier !== "FREE";
}

// The ONLY place that maps a Paddle price ID back to a PlanTier — used by
// the webhook handler so a subscription's actual purchased price decides
// the tier (never hardcoded), and stays correct automatically as soon as a
// tier's price ID env var is set.
export function planTierForPriceId(priceId: string | null): PlanTier | null {
  if (!priceId) return null;
  const entry = (Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]).find(
    ([, plan]) => plan.paddlePriceId === priceId,
  );
  return entry?.[0] ?? null;
}

// docs/outrun/14 "FREE PLAN" ("One User") and "STARTER PLAN" ("Single
// User") are explicit about a 1-seat cap; Growth's own feature list adds
// "Team Collaboration"/"Shared Workspace" with no numeric cap given, and
// Unlimited is explicitly "Unlimited Users" — so Growth and Unlimited are
// left uncapped (null) here rather than inventing a number the docs don't
// specify. A seat = one active membership OR one pending invitation
// (src/lib/teams/invite.ts counts both, since a pending invite reserves a
// seat the moment it's sent).
export const SEAT_LIMITS: Record<PlanTier, number | null> = {
  FREE: 1,
  STARTER: 1,
  GROWTH: null,
  UNLIMITED: null,
};
