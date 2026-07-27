# Outrun

**Your AI Growth Partner.**

Outrun is an AI Growth Operating System, not a CRM, lead database, dashboard
tool, or sales platform. Lead generation is the first department; Marketing,
SEO, Finance, Strategy, Customer Success, Business Intelligence, and a
MissedCallIO integration are future departments. Everything built today must
make those future departments easy to integrate.

This repository is currently a clean slate (no application code has been
committed yet). Before writing any product code, read the specification
below — it is the binding source of truth for product, design, AI behaviour,
and architecture decisions in this repo.

## The governing documents

Read `docs/outrun/16-outrun-constitution.md` first. It overrides all other
implementation preferences: whenever requirements conflict or multiple
solutions are possible, its twenty articles decide the outcome. Its core
mandate — repeated throughout every doc below — is that every feature must
answer one question: **"What is the next best thing this business should do
to grow?"** If a screen, endpoint, or recommendation doesn't answer that, it
gets redesigned or removed.

The full V1 specification is split into focused documents under
`docs/outrun/`:

| Doc | Covers |
|---|---|
| `01-brand-design-product-principles.md` | Mission, core product principles, colour palette, typography, spacing, motion, loading/empty/error states, the three "wow" moments |
| `02-landing-page-user-journey.md` | Marketing site structure, hero, pricing, FAQ, landing page rules |
| `03-authentication-onboarding.md` | Auth methods, account creation, conversational business-discovery flow, AI analysis loading, the Growth Blueprint reveal, paywall timing |
| `04-dashboard-mission-control.md` | Mission Control layout, Today's Mission, Growth Score, AI Opportunities, daily briefing, streaks |
| `05-growth-blueprint-engine.md` | The signature Growth Blueprint: structure, scoring, ICP, roadmap, confidence, exports, versioning |
| `06-lead-discovery-research-scoring.md` | Natural-language search, filters, Fit/Confidence scores, AI company research, lead lists |
| `07-outreach-engine-campaigns.md` | Campaign builder flow, AI-generated outreach, follow-ups, Autonomous Growth Mode, A/B testing |
| `08-business-brain-ai-memory.md` | The persistent memory layer every AI feature and future agent reads from |
| `09-seo-growth-engine.md` | AI SEO consultant: crawl, health score, keyword/content generation, local SEO |
| `10-ai-growth-partner.md` | The flagship AI Growth Partner: daily briefing, decision engine, risk detection, what-if simulator |
| `11-integrations-api-architecture.md` | Provider-abstraction rules for CRM/email/calendar/analytics/payments/AI providers, webhooks, events |
| `12-database-architecture-scalability.md` | Core tables, multi-tenancy, caching, background jobs, scalability targets |
| `13-backend-frontend-architecture.md` | Recommended stack, project structure, service/repository layering, definition of done |
| `14-billing-subscriptions-teams-enterprise.md` | Plan tiers (Free/Starter/Growth/Unlimited), usage metering, teams, feature gating |
| `15-security-devops-deployment.md` | Security-by-default requirements, environments, CI/CD, observability, incident response |
| `16-outrun-constitution.md` | The 20 Articles — the highest-level guiding document |

## Non-negotiables when building in this repo

- **No placeholders, no demo features.** This is production SaaS; every
  feature shipped must be scalable, maintainable, and complete per
  `13-backend-frontend-architecture.md`'s Definition of Done.
- **Explain every AI output.** Recommendations must separate observed facts,
  AI inferences, predictions, and assumptions, and state a confidence level.
  Never present a prediction as certainty (Article IV, Article VIII).
- **Modularity above all.** AI providers, lead-data providers, and
  integrations must sit behind interfaces so they're replaceable without
  touching business logic (Article X, `11-integrations-api-architecture.md`).
- **Simplicity over complexity.** No feature that needs a manual to use, no
  more than three clicks for a common task, no feature added just because a
  competitor has it (Article II, Article XIV).
- **Security by default.** Multi-tenant isolation, encryption at rest/in
  transit, server-side authorization on every request — never trust the
  frontend (`15-security-devops-deployment.md`).
- **Design system.** Dark charcoal (#181818) premium theme per
  `01-brand-design-product-principles.md` — calm, minimal, confident. Never
  ship a raw "No data" empty state or a stack trace in an error message.

When a decision isn't covered explicitly, resolve it using the Constitution's
final test: *"If this were the only product this business owner used every
day, would they trust it enough to run their company?"*
