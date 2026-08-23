# Deploying Outrun

This covers what's needed to run Outrun outside of local development.
Everything here is infrastructure/account setup — no code changes are
required to go live once these are in place.

## 1. Hosting

Next.js deploys cleanly to **Vercel** (zero-config) or any Node host that
can run `npm run build && npm run start` (Railway, Fly.io, Render). Vercel
is the least-friction choice unless you want the app and database on the
same platform.

## 2. Production database

Local dev uses a Postgres instance running in the sandbox — it does not
persist. Before deploying, provision a real Postgres database. Any of
these work with zero code changes (just set `DATABASE_URL`):

- [Neon](https://neon.tech) — serverless Postgres, generous free tier
- [Supabase](https://supabase.com) — Postgres + extras
- [Railway](https://railway.app) — Postgres alongside your app
- Amazon RDS — if you're already on AWS

Once you have a connection string, run the migration history that's
already tracked in `prisma/migrations/`:

```bash
npx prisma migrate deploy
```

Never run `prisma db push` against production — it doesn't produce a
migration history and can silently apply destructive changes. `db push`
is a dev-only convenience; `migrate deploy` is what CI/deploy should run.

## 3. Environment variables

Copy `.env.example` and fill in real values. Every variable is documented
inline there. Summary of what's required vs. optional:

| Variable | Required? | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Production Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes | Generate a **fresh** one per environment: `openssl rand -base64 32`. Never reuse the dev secret. Also encrypts stored OAuth tokens (see §9l) — rotate carefully. |
| `BETTER_AUTH_URL` | Yes | Your production URL, e.g. `https://app.yourdomain.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Enables "Continue with Google"; hidden until set |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` | Optional | Enables "Continue with Microsoft"; hidden until the client ID/secret are set |
| `RESEND_API_KEY` / `EMAIL_FROM` | **Yes in production** | Sign-up now requires a verified email before a session is issued (see §9h) — without a real send path, a new user's verification link only ever reaches the server console and they can never get in. Safe to leave unset in development only. |
| `ANTHROPIC_API_KEY` | Yes | Growth Blueprint, company research, and outreach generation all depend on this |
| `GOOGLE_PLACES_API_KEY` | Optional | Prospect search works with no config via OpenStreetMap (free, no key); set this to upgrade to Google Places for the best data quality (ratings, review counts) |
| `YELP_API_KEY` | Optional | Free, real API, tried before falling back to OpenStreetMap if `GOOGLE_PLACES_API_KEY` isn't set — denser local-business coverage than OSM, but never returns a business's own website. Get one free at yelp.com/developers/v3/manage_app |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | Yes | Billing |
| `NEXT_PUBLIC_PADDLE_ENVIRONMENT` | Yes | `sandbox` while testing, `production` when live |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Yes | Paddle → Developer Tools → Authentication → Client-side tokens |
| `NEXT_PUBLIC_PADDLE_STARTER_PRICE_ID` | Yes | The Price ID for the Starter product you create in Paddle's Catalog |
| `NEXT_PUBLIC_PADDLE_GROWTH_PRICE_ID` / `NEXT_PUBLIC_PADDLE_UNLIMITED_PRICE_ID` | Optional | Same as above for the Growth/Unlimited products. Each is independent — set one, both, or neither; an unset tier just shows "not sold yet" instead of a buy button (see §9m) |

## 4. Paddle webhook

In Paddle → Developer Tools → Notifications, add a webhook destination
pointed at:

```
https://<your-domain>/api/billing/webhook
```

Subscribe it to every `subscription.*` event. Copy the signing secret it
gives you into `PADDLE_WEBHOOK_SECRET`.

Every real subscription state change (activated, payment failed, canceled)
emails the workspace owner via `src/lib/billing/notifications.ts` — this
needs `RESEND_API_KEY` set to actually deliver; without it, notifications
log to the server console like every other email in this app.

Paddle itself sits behind a provider abstraction
(`src/lib/billing/provider/`), mirroring the AI-provider
(`src/lib/ai/`) and lead-data-provider (`src/lib/leads/`) pattern
already used elsewhere: a `PaymentProvider` interface with one method to
verify+parse a webhook into a normalized event and one to build a
customer-portal URL, a single `PaddlePaymentProvider` implementation,
and a `getPaymentProvider()` factory business logic calls instead of
importing the Paddle SDK directly. `src/lib/billing/webhook-handler.ts`
only ever sees the normalized event shape, not Paddle's own
`EventEntity`/`EventName` types — swapping processors means writing one
new class, not touching the plan-tier transition logic. Checkout itself
stays outside this abstraction (see the comment in
`src/components/billing/checkout-button.tsx`) since it's a browser-side
hosted overlay with no server round-trip and no shared shape across
processors to abstract.

## 5. Health check

`GET /api/health` returns `200 {"status":"ok"}` when the app can reach the
database, and `503` otherwise. Point your host's uptime/health check at
this endpoint.

## 6. Before taking real signups

- Replace the `[Insert ...]` placeholders in `/privacy`, `/terms`, and
  `/security` with real content, **reviewed by a lawyer** — the current
  copy is a structured starting point, not a legal document.
- Set `NEXT_PUBLIC_PADDLE_ENVIRONMENT=production` and use a live (not
  sandbox) Paddle price ID.
- Confirm `BETTER_AUTH_SECRET` was freshly generated for this environment.
- Confirm `RESEND_API_KEY` is set — required now that sign-up enforces
  email verification (§9h). Without it, no real user can ever complete
  sign-up.

## 7. Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request: it spins
up a throwaway Postgres service, applies the migration history with
`prisma migrate deploy`, then runs lint, typecheck, a Vitest suite
(`npm run test`), a full `next build`, and a Playwright E2E suite
(`npm run test:e2e`) against that build's dev server.

The Vitest suite mixes pure-function unit tests (scoring, mission
selection, SSRF checks, retry/backoff) with integration tests that hit
the same real Postgres service (usage-limit enforcement, the company
repository) — enforcement logic here is entirely DB-state-dependent, so
a mocked Prisma client would just re-assert the mock rather than catch a
real off-by-one in a query. Integration tests create and delete their
own throwaway `Organization` rows; nothing they do touches real data.

The Playwright suite (`tests/e2e/`) is deliberately scoped to golden
paths that don't require a configured AI or lead-data-provider key —
sign-up, sign-in, the marketing pages, and the health check. Flows that
need real AI generation (Blueprint, research, outreach, campaigns)
aren't covered here: there's no way to exercise them honestly in CI
without a live API key, and pretending to test them would be worse than
not testing them.

## 7a. Accessibility and security checks in CI

`tests/e2e/accessibility.spec.ts` runs `@axe-core/playwright` (WCAG
2 A/AA rules) against the public, unauthenticated pages — the marketing
site, sign-in, and sign-up — and fails the build on any `serious` or
`critical` violation. It's part of the same `npm run test:e2e` step
that already runs in CI, not a separate job. This is deliberately scoped
to pages that have already been fixed and verified; the authenticated
app (dashboard, prospects, campaigns, etc.) isn't scanned yet — that's
the separate "accessibility pass on key flows" work, since scanning
those pages before anyone has looked at them would just make this check
permanently red on issues nobody has triaged.

Fixing the violations this surfaced added a `--color-accent-text` token
(`src/app/globals.css`) — a lighter violet than `--color-accent` — for
accent-colored text sitting directly on a dark surface (links, badges),
since the original `--color-accent` only clears 4.5:1 as white text on
a solid fill (buttons), not as foreground text on `--color-bg-primary`/
`--color-card`. Only the specific components this pass touched
(auth cross-links, the shared `Badge` "accent" tone, the wow-demo label)
were migrated to it; most of the ~40 other `text-[var(--color-accent)]`
usages across the app haven't been audited yet.

CI also runs `npm audit --audit-level=high` (fails only on high/critical
advisories — see the known moderate-severity finding below) and a
weekly + per-PR CodeQL static analysis scan
(`.github/workflows/codeql.yml`), covering the "Security Scans" /
"Static Analysis" items in docs/outrun/15's deployment pipeline.

**Known accepted risk:** `npm audit` currently reports one moderate
PostCSS XSS advisory, reached transitively through `next` → `better-auth`.
The only fix available is a major-version downgrade of `next`
(`npm audit fix --force`), which is a worse trade than the advisory
itself. Re-check this after the next Next.js/Better Auth upgrade.

**Known accepted risk (high):** `npm audit` also reports a high-severity
`deepmerge-ts` stack-exhaustion advisory (GHSA-ggr8-5vv4-36mx), reached
via `prisma` → `@prisma/config` → `deepmerge-ts`. `prisma` is a
devDependency — its CLI (and the config-file loader `@prisma/config`
belongs to) never ships in the deployed app, only `@prisma/client` does —
so this can't be triggered by anything a request handler does at runtime.
No prisma release fixes it: every 6.x version through the latest 7.x
(checked exhaustively up to 7.9.1) still depends on the same vulnerable
`deepmerge-ts@7.1.5`; the only "fix" `npm audit fix --force` offers is an
unstable `prisma@6.13.0-dev.1` prerelease, a worse trade than the
advisory itself. CI's audit step (`.github/workflows/ci.yml`)
acknowledges this specific finding by package name (`deepmerge-ts`,
`@prisma/config`, `prisma`) rather than skipping the audit gate
entirely — any other high/critical finding still fails the build.
Re-check once Prisma ships a fix upstream.

## 8. Observability

Every server-side catch block calls `captureError()`
(`src/lib/observability.ts`) instead of a bare `console.error`. It always
emits a structured JSON log line — readable by any host's log
aggregation (Vercel, Railway, Fly...) with no extra setup. Set
`SENTRY_DSN` to additionally forward errors to Sentry (or any
Sentry-ingest-compatible service): this uses Sentry's plain HTTP envelope
endpoint directly, no SDK dependency, so it degrades to console-only
logging exactly like `sendEmail()` degrades without `RESEND_API_KEY`.
Render errors that escape every component boundary are caught by
`src/app/global-error.tsx`, which shows a friendly fallback screen (never
a stack trace) and reports through the same pipeline via
`/api/observability/client-error`.

## 9. Autonomous Growth Mode

An Owner/Admin can flip a per-campaign toggle so newly-generated outreach
sends automatically instead of waiting for a manual Send click — capped
by a daily limit they set. It's deliberately narrow: it only sends within
a campaign someone already reviewed and launched; it never generates or
launches a campaign on its own.

This needs a scheduler hitting `GET /api/cron/autonomous-send` — without
one configured, the toggle can be turned on but nothing will actually
send over time (the campaign page shows "last checked" so this is visible
rather than silently assumed). Two ways to wire it up:

- **Vercel**: `vercel.json` already defines a cron pointed at that route.
  Set the `CRON_SECRET` environment variable in your Vercel project —
  Vercel automatically attaches it as `Authorization: Bearer $CRON_SECRET`
  on every cron-triggered request, which the route checks. Note Vercel's
  Hobby plan only allows once-daily cron schedules; the 30-minute interval
  in `vercel.json` needs a paid plan.
- **Any other host**: `.github/workflows/autonomous-send.yml` runs every
  30 minutes and calls the same endpoint. Set the `APP_URL` and
  `CRON_SECRET` repository secrets in GitHub (Settings → Secrets and
  variables → Actions) — without both, the workflow logs a message and
  exits without calling anything.

Without `CRON_SECRET` set at all, the endpoint refuses every request
(`501`) rather than running unauthenticated — there is no way to trigger
real sends without deliberately configuring this.

## 9a. Strategic Reviews

docs/outrun/10 "STRATEGIC REVIEWS" — weekly, monthly, and quarterly
reviews generated from real events, campaign activity, and Growth
Blueprint score changes in that period. Owners can generate one on demand
from `/growth-partner/reviews`, but "generate automatically" needs the same
kind of scheduler as Autonomous Growth Mode above, hitting
`GET /api/cron/strategic-reviews` once a day — it checks every workspace
and only generates a review once enough time has passed since that
period's last one, so a daily cadence is enough even for weekly reviews.

- **Vercel**: `vercel.json` already defines this cron. Same `CRON_SECRET`
  as the autonomous-send cron above.
- **Any other host**: `.github/workflows/strategic-reviews.yml` runs
  daily and calls the same endpoint, using the same `APP_URL` and
  `CRON_SECRET` repository secrets.

Without `CRON_SECRET` set, this endpoint also refuses every request
(`501`) — reviews can still be generated manually from the UI regardless.

## 9b. Background job queue

docs/outrun/11-13 "BACKGROUND JOBS" — Growth Blueprint generation, SEO
analysis, and campaign generation (strategy + one outreach message per
selected company) all run as background jobs instead of blocking the
HTTP request that starts them, so a slow AI call can't time out the
request or make the UI look frozen.

There's no separate worker process or Redis/BullMQ here — this is a
serverless app, so `src/lib/jobs/queue.ts` is a Postgres-backed job table
plus Next's `after()`: the route that starts a job (`POST
/api/blueprint/generate`, `POST /api/seo/analyze`, `POST /api/campaigns`)
creates a `Job` row and returns a `jobId` immediately; `after()` then runs
the actual generation once the response has already been sent. The client
polls `GET /api/jobs/[id]` (via `src/lib/jobs/poll-job.ts`) until the job
reaches `SUCCEEDED` or `FAILED`.

Because `after()` still runs within the same invocation, each of these
routes sets `maxDuration` higher than the framework default (120s for
Blueprint/SEO, 300s for campaigns, since those generate one message per
company sequentially) — this needs a Vercel plan that allows raising
`maxDuration` past the Hobby tier's cap; on Hobby the actual ceiling is
still 60s regardless of what the route requests.

A second scheduler hits `GET /api/cron/job-queue` every 10 minutes to
sweep jobs that never got picked up (the serverless instance that
enqueued them was recycled before `after()` fired) or that have been
`RUNNING` for more than 10 minutes (the instance running them died
mid-flight) — same `vercel.json` cron / `.github/workflows/job-queue-sweep.yml`
/ `CRON_SECRET` pattern as the crons above. Without `CRON_SECRET` set,
jobs still normally complete via `after()`; the sweep is a safety net, not
the primary mechanism.

## 9c. Caching

docs/outrun/12 "CACHING" — the Organization + BusinessProfile read
(`getCurrentOrganization`, `src/lib/org.ts`) and the latest Growth
Blueprint read (`findLatestForOrg`,
`src/lib/repositories/growth-blueprint-repository.ts`, also used by the
Business Health Score) sit behind Next's `unstable_cache`, tagged
`org-profile:{organizationId}` / `growth-blueprint:{organizationId}`
(`src/lib/cache-tags.ts`). Both are read on nearly every authenticated
request but only change on a handful of writes, so caching them avoids
re-querying Postgres for the same row on every page load. No Redis —
this is Next's own Data Cache, which already works across serverless
instances against the same deployment.

There's no separate cache-warming or TTL tuning needed: every write that
changes these rows calls `revalidateTag()` right next to the write
(Blueprint generation, onboarding's Business Discovery save, the SEO
website field, the Blueprint share toggle, and the Paddle billing
webhook's plan-tier update). The 5-minute `revalidate` on each cached
read is a safety net for any write path that's missed, not the primary
invalidation mechanism. `unstable_cache` round-trips its return value
through JSON, which turns `Date` fields into strings — both cached
reads explicitly revive them back into real `Date` instances before
returning, so callers see identical types to an uncached Prisma call.

## 9d. Audit log, notifications, tasks, goals, contacts

docs/outrun/12 named five core tables that didn't exist yet — each ships
with a real read/write path, not just an empty schema addition:

- **AuditLog** (`src/lib/audit/log-audit-event.ts`) — a security/admin
  trail, separate from the Event log's growth timeline. Written at every
  role change and member removal (`src/lib/teams/invite.ts`), every
  Paddle plan-tier change (`src/lib/billing/webhook-handler.ts`), and
  every data export (Blueprint, campaign, strategic review, memory).
  Viewable at Settings → Team, Owner/Admin only.
- **Notification** (`src/lib/notifications/create-notification.ts`) —
  org-scoped (not per-user) in-app notifications, surfaced by the bell in
  the app top bar. Written when a background job succeeds (Blueprint,
  SEO analysis, campaign — `src/lib/jobs/queue.ts`), when a Strategic
  Review finishes, on billing state changes, and when a team member
  joins.
- **Task** (`src/lib/tasks/generate-from-blueprint.ts`) — every roadmap
  item from a freshly generated Growth Blueprint becomes a completable
  row at `/tasks`; users can also add their own. Deliberately additive to
  — not a replacement for — the ephemeral single "Today's Mission" on the
  dashboard (`src/lib/dashboard/mission.ts`), which still answers "what's
  the one next thing" while Tasks answers "what's the whole list and
  what's done."
- **Goal** (`/goals`) — supersedes `BusinessProfile.mainGoal` (a single
  free-text field) with a real, trackable list. Active goals are read
  into the Business Brain context (`src/lib/memory/context.ts`) so every
  Growth Partner response and Strategic Review is generated with them in view.
- **Contact** (`ContactsPanel` on a prospect's detail page) — a named
  person at a Company, distinct from `Company.contactEmail` (a generic
  inbox).

## 9e. Feature flags

docs/outrun/14 "FEATURE GATING" — "Every feature checks plan access.
Never hard-code plan names. Use feature flags." `src/lib/billing/feature-flags.ts`
is the single source of truth: dot-namespaced keys (`seo.engine`,
`growth_blueprint.export`, `team.workspaces`) mapped to the plan tiers
that unlock them, checked via `isFeatureEnabled(planTier, flag)` at both
the API route (server-side enforcement) and the page/component (so a
gated feature shows an upgrade prompt, not a raw 403 JSON blob).

Only FREE and STARTER have a real Paddle price today
(`src/lib/billing/plans.ts`) — gating anything behind GROWTH/UNLIMITED
would make it permanently unreachable, since no one can actually
subscribe to those tiers yet. `team.workspaces` is deliberately left
open to every tier for the same reason (matching the pre-existing
decision in `src/lib/teams/invite.ts`). Add a tier's Paddle price before
gating anything behind it.

`src/lib/billing/plans.ts` also centralizes `isPaidPlan()` (replaces
`planTier === "FREE"` checks) and `HIGHLIGHTED_TIER` (which plan card
gets the "most popular" styling) — every other hardcoded plan-tier
string comparison in the app should route through one of these three
helpers rather than comparing `PlanTier` literals directly.

## 9f. Second Wow Moment

docs/outrun/03 "SECOND WOW MOMENT" — right after the very first Growth
Blueprint (never a regeneration), Outrun automatically searches for
prospects using the Blueprint's own ICP, researches the top 3 by fit
score, and builds one ready-to-review campaign from them —
`src/lib/onboarding/second-wow.ts`, chained into the same background
job as Blueprint generation (`src/lib/jobs/queue.ts`'s
`BLUEPRINT_GENERATION` case enqueues and awaits a
`SECOND_WOW_GENERATION` job) so the client's single poll-and-navigate
wait covers both — by the time the user lands on `/blueprint`, the
campaign already exists. Requires `maxDuration = 300` on
`/api/blueprint/generate` to cover the extra AI calls.

Deliberately capped at 3 companies (not the "184" in the doc's own
illustrative copy): Free plan's usage limits are only 10
searches/10 research/5 outreach a month, and this should feel like real
work got done without silently spending the user's entire trial before
they've touched the product themselves.

Every step degrades honestly, never fabricating a result: if
`GOOGLE_PLACES_API_KEY` isn't configured, a usage limit is already
exhausted, or nothing was found, the job still succeeds with an empty
result and the Blueprint page shows the plain "Continue to Dashboard"
button instead of a stat block with invented numbers. A failure here
never fails the Blueprint job itself, since the Blueprint already
succeeded.

## 9g. Mission Control dashboard rebuild

docs/outrun/04 rebuild of `/dashboard` — everything the spec calls for
that wasn't there before:

- **Campaign Overview** (`src/lib/dashboard/campaign-overview.ts`) —
  groups campaigns by status. This schema's `CampaignStatus` is
  DRAFT/READY/PAUSED/COMPLETED (no separate "scheduled" state), so READY
  is shown as "Running" and DRAFT as its own bucket rather than
  inventing a "Scheduled" one. Per-campaign cards show real company/
  sent/reply counts only — meetings and pipeline value aren't tracked
  anywhere in this schema, so they're never estimated here.
- **Business Snapshot** (`src/lib/dashboard/business-snapshot.ts`) —
  Revenue Goal reads the org's `Goal` row whose `targetMetric` contains
  "revenue"; Meetings Booked and Pipeline Value render literally as "Not
  tracked yet" rather than a fabricated number, since neither has a
  backing field anywhere in the schema.
- **Streaks** (`src/lib/dashboard/streaks.ts`) — the "Growth Streak" is
  honestly defined as consecutive days with at least one logged
  Business Brain `Event`, not literal daily-mission completion (nothing
  persists that signal today). Weekly Reviews Completed and Campaigns
  Launched are real counts (`StrategicReview` rows, non-DRAFT
  campaigns).
- **Right sidebar** (`src/components/dashboard/right-sidebar.tsx`, data
  from `src/lib/dashboard/right-sidebar-data.ts`) — AI Assistant links
  to `/growth-partner` with a teaser drawn from the same risk/opportunity
  signals already shown on the dashboard; Recent Notifications and
  Upcoming Tasks are real queries (tasks without a due date sort by
  impact, since blueprint-generated tasks rarely have one); Growth Tip
  surfaces the lowest-scoring Business Health category's own
  `fastestImprovement` text — never a generic tip.
- **Global search** (`src/app/api/search/route.ts`,
  `src/components/dashboard/global-search.tsx`) — a plain, real
  substring search across the org's own Prospects/Campaigns/Tasks/Goals.
  Deliberately labeled "Search," not "AI Search" — there's no
  intent-routing engine behind the doc's natural-language examples yet,
  and claiming one would be dishonest.
- **Loading/error states** — `src/components/ui/skeleton.tsx` plus
  `src/app/(app)/dashboard/loading.tsx` for the skeleton, and
  `src/app/(app)/dashboard/error.tsx` as a route-scoped error boundary
  (reports to `/api/observability/client-error` like the existing global
  one, but renders with the real design system instead of inline styles).

`EVENT_LABELS` was extracted to `src/lib/memory/event-labels.ts` (now
covering every `EventType`, not just the subset `/memory` originally
had) so the Recent Activity widget and the AI Memory timeline never
disagree on how an event is labeled.

## 9h. Magic Link, Microsoft, session management, email verification

docs/outrun/03 "AUTHENTICATION" — the remaining auth requirements beyond
Google + email/password:

- **Magic Link** (`src/lib/auth.ts`'s `magicLink` plugin,
  `src/components/auth/magic-link-panel.tsx`) — a password-less
  alternative on both `/sign-in` and `/sign-up` ("Email me a sign-in
  link instead"). Reuses the same `sendEmail()` seam as verification/
  reset. A new account is created automatically the first time an
  unrecognized email uses it, so the one form covers sign-up too.
- **Microsoft** (`genericOAuth` + the `microsoftEntraId` preset, since
  Better Auth has no first-class `socialProviders.microsoft` the way it
  does for Google) — gated behind `MICROSOFT_CLIENT_ID`/
  `MICROSOFT_CLIENT_SECRET` exactly like Google's `googleConfigured`
  pattern, surfaced through the same `/api/auth/config` flag mechanism.
- **Email verification is now enforced**
  (`emailAndPassword.requireEmailVerification: true`) — a credential
  sign-up no longer returns a session; the user is sent to
  `/verify-email` (`src/app/verify-email/page.tsx`) until they click the
  emailed link. `emailVerification.autoSignInAfterVerification: true`
  means clicking that link signs them in directly and carries them to
  `/welcome` (the sign-up form's `callbackURL`), rather than making them
  sign in a second time. OAuth and Magic Link sessions are always
  already verified (Google/Microsoft report `emailVerified` on the
  account; clicking a magic link **is** the verification), so neither
  path is affected. `src/app/(app)/layout.tsx` additionally redirects
  any session with `emailVerified: false` to `/verify-email` as a
  defense-in-depth backstop, though in practice the flag above already
  prevents such a session from existing.
- **Session/device management**
  (`src/app/(app)/settings/security/page.tsx`,
  `src/components/settings/sessions-panel.tsx`) — lists every active
  session (parsed device/browser from `Session.userAgent`, IP, last
  active) using Better Auth's core session endpoints directly
  (`listSessions`/`revokeSession`/`revokeOtherSessions` — no extra
  plugin needed, since the requirement is "view and revoke my own
  sessions," not concurrent multi-account sessions in one browser).
  Marks the current session and lets the user revoke any other one
  individually, or all of them at once.
- **Remember me** — turns out to already be a native `signIn.email`/
  `signUp.email` option (`rememberMe: false` issues a browser-session-only
  cookie instead of the normal 30-day one); `/sign-in` now exposes it as
  a checkbox, defaulting to checked.

## 9i. Natural-language prospect search

docs/outrun/06 "GLOBAL SEARCH" — `src/lib/leads/query-parser.ts` sits
between the search box and `CompanyDataProvider.search()`. Google
Places' own Text Search already handles plain "industry in location"
phrasing, but has no concept of qualifiers like "that recently hired
staff" or "using HubSpot" — passed through verbatim, those words just
degrade the text match. `parseSearchQuery()` uses the AI provider to
split a free-text request into three honest pieces:

- `placesQuery` — a clean industry+location phrase for Places
- `postFilters` — only qualifiers Outrun can actually verify from data
  Places returns (website presence, star rating, review count) — never
  a filter for something Places can't tell it
- `unsupportedIntents` — every other qualifier mentioned (funding,
  hiring activity, tech stack, "weak SEO" beyond having no site at all),
  surfaced to the user in `/prospects` ("Outrun can't yet verify: …")
  rather than silently dropped or faked as a working filter

Degrades honestly without `ANTHROPIC_API_KEY`: `parseSearchQuery`
returns the raw query untouched (same behavior as before this feature
existed) rather than blocking search on an AI call it can't make.

## 9j. Prospect filters, bulk actions, and exports

docs/outrun/06 "FILTERS" lists many qualifiers (employee count, revenue,
tech stack, funding, hiring activity) that nothing in this schema or the
lead-data provider can actually verify — `src/components/prospects/
filter-bar.tsx` only implements the ones backed by real `Company` fields:
category, minimum rating, minimum review count, website presence, and
saved status. Filters apply client-side to whatever result set is
already on screen (a search's results, or a Lead List's companies) —
this is search/list refinement, not a new "browse every company ever
found" view.

- **Bulk selection** — a checkbox per company (`CompanyCard`'s
  `onToggleSelect`, and inline in `LeadListDetailClient`) feeds
  `src/components/prospects/bulk-actions-bar.tsx`, which appears once
  anything is selected.
- **Bulk actions**: add selected to a list (loops the existing
  single-company `POST /api/prospects/[id]/lists`), save selected
  (`POST /api/prospects/bulk-save` — sets `isSaved: true` unconditionally
  rather than reusing the single-company endpoint's *toggle*, since
  toggling a mixed-state selection would be ambiguous), and — inside a
  Lead List only — remove selected from that list.
- **Export** (`POST /api/prospects/export`, `{ companyIds, format }`) —
  CSV (a from-scratch RFC 4180 writer, `src/lib/prospects/export-csv.ts`
  — no CSV library existed in this codebase before) and PDF (reusing the
  `@react-pdf/renderer` pattern already established for Growth Blueprint
  exports, `src/lib/prospects/export-pdf.tsx`). "Excel" from the doc's
  "CSV/Excel/PDF" is served by the CSV file — it opens in Excel natively;
  a true `.xlsx` would need a new dependency this codebase doesn't carry
  and isn't required to satisfy that use case. Gated behind a new
  `FEATURE_FLAGS.PROSPECTS_EXPORT` flag (Starter and above, same tiers as
  `GROWTH_BLUEPRINT_EXPORT`) — a new flag rather than reusing the
  Blueprint-specific one, since campaign/growth-partner/memory exports set the
  precedent of each export having its own gate rather than sharing one.

## 9k. Autonomous Growth Mode opportunity-finding

docs/outrun/07 "AUTONOMOUS GROWTH MODE" lists nine signal types Outrun
should continuously watch for. `src/lib/growth-partner/opportunity-feed.ts`
(already the shared "Opportunity Feed" engine behind `/growth-partner`, now
also rendered on `/campaigns` under an "Autonomous Growth Mode" heading)
gained two new real, deterministic signals on top of its existing
Growth-Blueprint/SEO ones:

- **Unactioned high-fit prospects** — companies with `fitScore >= 70`
  that have zero `OutreachMessage` rows. Deliberately *not* a live
  re-search against the lead-data provider on every page load (that
  would burn API quota silently on each read) — it surfaces companies
  Outrun already found instead.
- **Reply-rate trend** — a real time-windowed comparison (last 14 days
  vs. the 14 days before that, `TREND_MIN_SAMPLE = 5` per window), not
  a cross-sectional bucket split. Only fires on a genuine ≥10-point
  decline with enough sends in both windows — same honesty bar as the
  Improvement Loop (`src/lib/campaigns/improvement-loop.ts`, which
  already covered "better-performing subject lines" from a past task
  and is reused as-is, not duplicated).

Three of the doc's signal types — **emerging industries, competitor
changes, pricing observations** — have no real data source anywhere in
this app (no market-data feed, no competitor/pricing tracking) and are
deliberately left unbuilt rather than faked; "content ideas" and
"website improvements" are already covered by the existing SEO-sourced
items in the same feed. "Nothing is launched without user approval" is
enforced structurally — this feed only ever renders read-only
recommendations with a link to the real page where a human acts on it.

## 9l. OAuth token encryption at rest

docs/outrun/11 "Encrypted Credential Storage" / docs/outrun/15 "Encrypt:
Tokens, Credentials". Google/Microsoft sign-in stores each provider's
`accessToken`, `refreshToken`, and `idToken` on the `Account` row — until
now, in plain text. `src/lib/auth.ts` sets Better Auth's own
`account.encryptOAuthTokens: true`, which AES-256-GCM-encrypts those
three columns before every write and transparently decrypts them on the
read paths that actually use them (token refresh, account info), keyed
off `BETTER_AUTH_SECRET`. No app code reads these columns directly via
Prisma (confirmed by grep), so nothing outside Better Auth's own account
routes needed to change. One consequence worth knowing before rotating
`BETTER_AUTH_SECRET` in production: do it via Better Auth's multi-version
secret support (`keys`/`currentVersion`), not a bare swap — a bare swap
strands every already-encrypted OAuth token, forcing every OAuth-linked
user to re-link their provider.

## 9m. Growth and Unlimited plans are purchasable

docs/outrun/14: only Starter had a real checkout path — `src/lib/billing/plans.ts`
hardcoded `paddlePriceId: null` for Growth and Unlimited, and the Billing
page only ever rendered a `CheckoutButton` for one hardcoded tier
(`HIGHLIGHTED_TIER`). Fixed structurally, not just with new env vars:

- `plans.ts` reads each paid tier's price ID from its own env var
  (`NEXT_PUBLIC_PADDLE_{STARTER,GROWTH,UNLIMITED}_PRICE_ID`); the Billing
  page (`src/app/(app)/billing/page.tsx`) now renders a real
  `CheckoutButton` for **any** tier whose price ID resolves, so wiring up
  Growth/Unlimited in production is only ever an env-var change.
- The webhook handler (`src/lib/billing/webhook-handler.ts`) previously
  hardcoded every active subscription to `"STARTER"` regardless of what was
  actually purchased — a real bug that would have silently mis-tiered any
  Growth/Unlimited buyer even after the checkout button existed. It now
  resolves the purchased tier from the subscription's actual Paddle price
  ID (`planTierForPriceId()` in `plans.ts`), falling back to Starter with a
  captured error only if an active subscription's price ID doesn't match
  any configured tier (a deleted/changed Paddle price, or a misconfigured
  env var) — so a real mismatch surfaces instead of silently under- or
  over-granting access.
- `CheckoutButton`'s label is now parametrized by plan name instead of
  hardcoded "Upgrade to Starter".

## 9n. API Access (Limited)

docs/outrun/14 lists "API Access (Limited)" as a current Growth-plan
feature (and Unlimited's own list already said "API access") — but no
API-key model, issuance flow, or externally-callable authenticated
endpoint existed anywhere. It was a checked box with nothing behind it
(Article XIII "Honest Marketing"). Now real, minimal scope on purpose:

- **Issuance**: Settings → API Keys (`/settings/api-keys`, Owner/Admin
  only, `src/lib/teams/permissions.ts`'s `canManageApiKeys`). The raw key
  (`ok_live_...`) is shown exactly once at creation and never persisted —
  only its SHA-256 hash (`src/lib/api-keys/crypto.ts`), the same
  never-store-plaintext principle Better Auth already applies to OAuth
  tokens (§9l). Capped at 10 active keys per org.
- **Gating**: a new `API_ACCESS` feature flag (`src/lib/billing/feature-flags.ts`)
  restricted to Growth/Unlimited, matching doc 14's own plan copy. Checked
  twice — once for issuance, and again on every request the key makes
  (`resolveOrganizationForApiKey` in `src/lib/api-keys/service.ts`) — so a
  key issued on Growth stops working the moment the org drops back to
  Free/Starter, not just stops being issuable.
- **The one real endpoint**: `GET /api/v1/public/prospects`
  (`Authorization: Bearer <key>`), read-only, rate-limited
  (`RATE_LIMITS.PUBLIC_API`, 60/min), returns only fields already visible
  in the in-app Prospects list — no internal `research` JSON, no contact
  PII beyond what a user could already see. `X-API-Version` is stamped on
  it automatically by the same `/api/*` middleware (`src/proxy.ts`) every
  other route gets.
- **Audit**: key creation/revocation both log `API_KEY_CREATED`/
  `API_KEY_REVOKED` audit events (doc 11 "Audit API access").
- **Deliberately not built**: more resources, request signing beyond
  Bearer-token TLS, per-key custom rate limits, and API documentation
  beyond this section and the route's own header comment — none of those
  are specified anywhere in the docs, and "API Access (Limited)" is
  exactly that: limited. Add more read endpoints behind the same
  `resolveOrganizationForApiKey` auth path as real need appears.

## 9o. Team seat limits

docs/outrun/14's Free and Starter plans are explicit ("One User" /
"Single User"); anyone could invite unlimited members on either tier
until now, and the Billing Dashboard was also missing the "Team Seats"
display doc 14 requires. `src/lib/billing/plans.ts`'s `SEAT_LIMITS`
caps Free and Starter at 1 seat each; Growth and Unlimited are left
uncapped (`null`) rather than inventing a number the docs don't give —
Growth's own feature list only says "Team Collaboration"/"Shared
Workspace" with no numeric limit, and Unlimited is explicitly "Unlimited
Users". A seat is one active membership OR one pending invitation
(`getSeatUsage()` in `src/lib/teams/invite.ts`) — a pending invite
reserves the seat the moment it's sent, not just once accepted.
`createInvitation` re-checks the limit server-side on every call
(Article XII), independent of anything the invite form itself disables.
The Billing page now shows "Team Seats" (used / limit, or "Unlimited")
next to the existing Usage card.

## 9p. Full account/workspace data export

Article XVIII "Users own their data. Users can export it." paired with
the real deletion flow added earlier (§9j) — deletion existed, export
didn't. Settings → Team → "Export Your Data" (Owner/Admin only, same
scope as `canManageTeam`, since a full export covers every member's
data at once) downloads a single JSON file
(`src/lib/export/account-export.ts`'s `buildAccountExport()`) covering
everything the workspace owns: Business Profile, every Growth Blueprint
version, prospects (with contacts and outreach messages), campaigns,
tasks, goals, lead lists, SEO analyses and generated content, the
growth timeline (Business Brain events), and AI chat history. Rate
limited the same as every other export
(`RATE_LIMITS.EXPORT`) and logs a `DATA_EXPORTED` audit event.

Deliberately excluded: `Account` rows (OAuth tokens, password hashes —
pure auth infrastructure, not "business data," and exporting them would
be a security regression) and `ApiKey.keyHash` (key metadata is
included, the secret itself never is — matches the "shown once, never
persisted in cloud text" principle §9n already established for keys
themselves). Generated synchronously and streamed directly in the
response, matching every other export in this app (prospect CSV/PDF,
Growth Blueprint exports) rather than a background job — this codebase
has no blob/file storage layer to hand a job's result to yet (doc 12
calls that out as a still-unbuilt piece), and per-tier usage limits keep
a typical export small enough that synchronous generation doesn't risk
timing out.

## 9q. Provider-interface convention for future CRM/Calendar/Analytics integrations

docs/outrun/11 "ARCHITECTURE PRINCIPLES" — "Every provider should
implement a common interface... no integration should require major
changes to the application architecture." Three categories already
follow this: AI (`src/lib/ai/`), payments (`src/lib/billing/provider/`,
documented in §4), and lead data (`src/lib/leads/`) — in each, business
logic imports a provider-agnostic interface and a `get*Provider()`
factory, never a vendor SDK directly, so swapping or adding a vendor is
one new class, not a sweep across call sites.

CRM, Calendar, and Analytics (doc 11's remaining "Future integrations"
categories) don't exist in this codebase yet — no HubSpot/Salesforce
sync, no Google Calendar booking, no GA/GSC ingestion. Deliberately not
writing an interface for any of them ahead of a real implementation:
each category's actual shape only becomes clear once there's a first
concrete vendor to abstract over (contact/deal sync for CRM looks
nothing like a calendar's availability/booking calls, which looks
nothing like analytics' read-only metrics pull — forcing one shared
interface across all three now would be exactly the kind of
speculative, no-real-caller abstraction this codebase's own principles
warn against). When the first CRM (or Calendar, or Analytics)
integration is actually built, give that category its own interface
following the same three-piece shape as the existing ones: a
provider-agnostic type/interface file, one concrete class per vendor,
and a factory function — not a change to `Company`/`Contact` or any
other core model, and not a single interface spanning unrelated
categories.

## 9r. Outgoing webhook delivery

docs/outrun/11 "WEBHOOK SYSTEM — Outgoing webhooks, Retry logic,
Signature verification, Logging, Dead-letter queue for failures" /
"EVENT SYSTEM — Every major action generates an event... these events
should power future automation." Settings → Webhooks (Owner/Admin only,
`canManageWebhooks`) lets a customer register their own URL (a Zapier
"Webhooks" trigger, their own server, etc.) and receive a signed POST
for every event Outrun already logs — Campaign Created, Growth
Blueprint Updated, Task Completed, and every other `EventType`.

Wired at a single entry point: `src/lib/memory/log-event.ts`'s
`logEvent()` (already called at every meaningful business action) now
also calls `dispatchEvent()` (`src/lib/webhooks/dispatch.ts`), so every
current and future event type reaches registered webhooks automatically
— nothing to wire up at each of `logEvent`'s call sites individually.

`dispatchEvent()` only ever creates a `PENDING` `WebhookDelivery` row —
it deliberately never attempts the actual HTTP call inline. `logEvent()`
runs mid-request from dozens of places across this app; awaiting a
customer's own (possibly slow or down) endpoint there would let one
unrelated webhook target's slowness slow down Outrun's own request
handling (doc 11 "Asynchronous where possible"). A scheduler hitting
`GET /api/cron/webhooks` every 5 minutes (`vercel.json` /
`.github/workflows/webhook-sweep.yml`, same `CRON_SECRET` pattern as the
other crons) is the only thing that ever calls `attemptDelivery()` —
tighter than the job queue's 10-minute sweep (§9b) since this is the
actual delivery mechanism, not just a safety net for missed jobs.

Each attempt HMAC-SHA256-signs the raw JSON body with the endpoint's own
secret (shown once at creation, AES-256-GCM-encrypted at rest via
`src/lib/webhooks/crypto.ts`, keyed off `BETTER_AUTH_SECRET` the same
way §9l's OAuth token encryption is) and sends it as `X-Outrun-Signature`
so the receiving end can verify authenticity. Failures retry with
exponential backoff (2 minutes, doubling, up to 6 attempts) before the
delivery is marked `DEAD_LETTER` and logged via `captureError` — the
same error-tracking pipe every other failure in this app already goes
through, not a second notification channel. The target URL is validated
against the same SSRF guard as the website crawler (`src/lib/security/ssrf.ts`)
both at registration and again at every delivery attempt, since a URL
that resolved publicly when registered could later resolve to a private
address via DNS rebinding.

## 9s. Configurable/custom permissions — deliberately not built in V1

docs/outrun/14 "PERMISSIONS" — "Permissions should be configurable for
enterprise customers" — sits directly under the fixed five-role table
(Owner/Admin/Manager/Member/Viewer, `src/lib/teams/permissions.ts`).
That line reads like a V1 gap, but the same document's own "ENTERPRISE"
section lists "Custom Roles" explicitly under **Future Enterprise
features** ("Do not build in V1" is stated outright for Agency Mode
right above it, and the same future-scope framing applies here) —
alongside SSO, SCIM, and Private AI Models, none of which exist either.
There is also no "Enterprise" plan tier in this codebase to gate custom
roles behind (`src/lib/billing/plans.ts` has Free/Starter/Growth/
Unlimited only). Building configurable-role infrastructure now would
mean inventing both a tier and a permissions model with zero real
customer to validate the shape against — exactly the kind of
speculative abstraction this codebase's own principles (and the
provider-interface decision in §9q) argue against. Revisit once an
Enterprise tier is real.

## 10. Rate limiting

docs/outrun/15 "RATE LIMITING". Authentication (sign-in, sign-up,
password reset) is protected by Better Auth's own built-in limiter
(`src/lib/auth.ts`), explicitly enabled with Postgres-backed storage so
limits hold across serverless instances rather than resetting per cold
start. AI generation endpoints, prospect search, data exports, and
webhook endpoints (Paddle, the autonomous-send and strategic-reviews
crons) are protected by a
separate app-level limiter (`src/lib/rate-limit.ts`, also Postgres-backed,
fixed-window). No configuration needed — both work out of the box against
the same `DATABASE_URL` already required for everything else.

## 11. Backups and disaster recovery

docs/outrun/15 "BACKUPS" / "DISASTER RECOVERY". Outrun has exactly one
piece of durable state: the Postgres database. There's no separate cache
or datastore to back up — the background job queue (section 9b) is just
rows in that same database, not a separate system — so the recovery
story is really "how do we get Postgres back."

**Backups.** Don't build a custom backup job — every provider listed in
section 2 already does this better than a hand-rolled `pg_dump` cron:

| Provider | Automated backups | Point-in-time recovery |
|---|---|---|
| Neon | Yes, included | Yes (retention depends on plan) |
| Supabase | Yes, daily on paid plans | Yes on paid plans |
| Railway | Yes, via volume snapshots | Limited — check current plan docs |
| Amazon RDS | Yes, configurable window | Yes, up to the retention period |

Whichever you use: turn on automated backups and PITR in that provider's
dashboard, and set the retention window to at least 7 days. Encryption at
rest is the provider's default on all four — verify it's on rather than
assuming.

**Recovery testing.** A backup nobody has restored is a hope, not a
backup. Quarterly (or before any major migration), restore the latest
backup into a throwaway database and run:

```bash
DATABASE_URL="<restored-db-url>" npx prisma migrate deploy
DATABASE_URL="<restored-db-url>" npx prisma studio
```

Confirm the migration history applies cleanly and spot-check a few
tables (organizations, memberships, growth blueprints) for plausible
data. Record how long the restore took — that number is your actual RTO,
not an estimate.

**Disaster scenarios this app can actually hit:**

- **Database failure/corruption** — restore from the provider's latest
  backup/PITR checkpoint as above; there's no secondary datastore to fail
  over to, so this is the one true single point of failure. Mitigate by
  keeping backup retention long enough to catch corruption that isn't
  noticed immediately.
- **AI provider outage** (Anthropic) — every AI-backed route already
  fails closed with a friendly, specific error (`UserFacingError`) rather
  than a stack trace; nothing else in the app depends on it, so Mission
  Control, Prospects, Campaigns (browsing/sending), Billing, and Teams
  all keep working normally during an outage.
- **Email provider outage** (Resend) — `sendEmail()` throws, which
  surfaces as a friendly "couldn't send" error on outreach sends and
  billing notifications; auth verification/reset emails fail the same
  way. No feature silently pretends to have sent something that didn't
  go out.
- **Lead data provider outage** (Google Places) — prospect search fails
  with a friendly error; previously-saved companies and all other
  features are unaffected.
- **Payment provider outage** (Paddle) — checkout/portal links fail
  gracefully; existing `planTier` stays whatever it was last set to by a
  verified webhook, so an outage can't silently downgrade or upgrade
  anyone.
- **Hosting/cloud outage** — covered by whatever multi-region/failover
  the host (Vercel/Railway/Fly/Render) provides; this app has no
  self-managed infrastructure to fail over.
- **Queue/worker failure** — there's no separate worker process to fail
  (section 9b): background jobs are rows in the same Postgres database,
  so a database restore recovers them too. If jobs stop completing while
  the database itself is healthy, that means the cron sweep
  (`/api/cron/job-queue`, section 9b) isn't running or `CRON_SECRET` is
  misconfigured — check the host's cron dashboard and the queue-depth
  alert described in the Monitoring section below.

## 11a. Monitoring and alerting

docs/outrun/15 "MONITORING" lists eight things to track (API latency,
database performance, queue length, worker health, memory, CPU, storage,
AI/integration availability) and says to alert when thresholds are
exceeded. This app doesn't run its own metrics/alerting service — most of
that list is already a dashboard your host and database provider give you
for free, and building a second one would just be a worse, unmaintained
copy of it:

| Signal | Where it's actually monitored |
|---|---|
| API latency, request volume, CPU, memory | Vercel/Railway/Fly/Render's own project dashboard — every host in section 1 shows this out of the box |
| Worker health | There's no separate worker process (section 9b) — background jobs run inside the same serverless function invocations as everything else via `after()`, so a function's own invocation/error logs on the host dashboard above are the worker health signal |
| Database performance, storage, connections | Neon/Supabase/Railway/RDS's own dashboard (section 2) — these already alert on storage limits and connection exhaustion by default on most plans |
| AI provider availability (Anthropic) | [status.anthropic.com](https://status.anthropic.com) — every AI-backed route already fails closed with a friendly error (`UserFacingError`) rather than hanging, so an outage degrades gracefully without paging anyone |
| Integration health (Paddle, Resend, Google Places) | Each provider's own status page; same fail-closed behavior as above |
| Unhandled exceptions, failed jobs, API failures | `captureError()` (section 8) — structured logs always, plus Sentry when `SENTRY_DSN` is set |

**What is checked in code, not delegated:** queue length. It's the one
metric on the doc's list that's specific to this app rather than generic
infrastructure, so `sweepStuckJobs()` (`src/lib/jobs/queue.ts`) counts
every `PENDING`/`RUNNING` job on each 10-minute cron run
(`/api/cron/job-queue`, section 9b) and calls `shouldAlertForQueueDepth()`
against a threshold (currently 20 — see the comment on
`QUEUE_DEPTH_ALERT_THRESHOLD` for why). When it's crossed, the route calls
`captureError()` with the current depth, going through the exact same
Sentry/log pipeline as every other error — there's no second alerting
channel to configure. If you have `SENTRY_DSN` set, set up a Sentry alert
rule on the `cron.job-queue.depth-alert` scope so it actually pages
someone instead of just sitting in the issue list.

## 12. Incident response

docs/outrun/15 "INCIDENT RESPONSE". A lightweight runbook so an incident
has a shape instead of everyone improvising in the moment. For each
category below: **detect** (how you'd find out) → **contain** (stop it
getting worse) → **communicate** (who needs to know, and what you tell
them) → **resolve** → **postmortem** (timeline, root cause, resolution,
preventive actions — write this down every time, even for small
incidents; it's the only way patterns become visible).

- **Security incident / data breach** — Detect via `captureError()`
  reports (Sentry, if configured) or a report from a user/researcher.
  Contain: rotate the affected secret(s) immediately (`BETTER_AUTH_SECRET`,
  `PADDLE_WEBHOOK_SECRET`, `CRON_SECRET`, API keys) and force-expire
  sessions if account compromise is suspected (`prisma.session.deleteMany`
  scoped to the affected user, or all sessions if the auth secret itself
  was exposed). Communicate: notify affected workspace owners directly;
  for a confirmed breach of personal data, legal counsel determines
  disclosure obligations (see `/privacy`) — don't self-diagnose this.
- **Provider outage** (Anthropic, Resend, Google Places, Paddle) — Detect
  via `captureError()` volume for that scope (`ai.*`, `billing.*`,
  `prospects.search`, etc.) or the provider's own status page. Contain:
  nothing to do — every dependency already fails closed with a friendly
  error rather than cascading (see section 11). Communicate only if it's
  prolonged enough that users will notice a pattern (e.g. a banner on
  the affected page). Resolve: wait for the provider, or swap
  credentials if the outage is account-specific.
- **Deployment failure** — Detect via CI (`.github/workflows/ci.yml`)
  failing, or `GET /api/health` returning `503` post-deploy. Contain:
  roll back to the last known-good deployment (your host's rollback —
  Vercel/Railway/Fly/Render all support one-click revert to a previous
  build). Never debug a bad deploy live in production; roll back first,
  investigate after.
- **Performance degradation** — Detect via slow `/api/health` responses
  or elevated error rates in `captureError()` logs. Contain: check
  Postgres connection pool exhaustion first (the most likely cause given
  this app's single-database architecture) — look at the provider's
  connection dashboard. Resolve: scale the database plan, or add
  connection pooling (e.g. PgBouncer / Neon's built-in pooler) if not
  already in front of it.
- **Critical bug** — Detect via error reports or user reports. Contain:
  if it's actively harming users (e.g. sending wrong outreach content,
  double-charging), disable the specific feature rather than the whole
  app where possible — most AI/billing routes are isolated enough that
  this is surgical (e.g. temporarily unsetting `RESEND_API_KEY` disables
  all outbound email without taking down anything else). Fix forward
  with a real commit, not a hotfix patched directly in production.
