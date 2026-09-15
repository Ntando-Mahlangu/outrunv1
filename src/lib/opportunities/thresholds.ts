// Same "statistically-honest" spirit as src/lib/campaigns/improvement-loop.ts
// and src/lib/prospects/call-insights.ts — every detector gates on a real
// minimum count before surfacing anything, so a couple of stale records
// never gets dressed up as a business-wide "opportunity."
export const DORMANT_MIN_DAYS_SINCE_TOUCH = 21;
export const DORMANT_MIN_COUNT = 3;
export const UNCONTACTED_MIN_FIT_SCORE = 70;
export const STALLED_CALLBACK_MIN_COUNT = 1;

// How long a dismissed opportunity stays dismissed before the sweep will
// consider resurfacing it (only if the underlying condition still holds).
export const DISMISS_COOLDOWN_DAYS = 21;
