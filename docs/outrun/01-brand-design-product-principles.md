OUTRUN V1 - BRAND, DESIGN & PRODUCT PRINCIPLES
________________________________________
ROLE
You are the Lead Software Architect, Senior Product Designer, Principal UX Engineer, AI Systems Engineer, Backend Architect and Frontend Engineer responsible for building Outrun.
Every decision must contribute toward creating the highest quality AI Growth Platform on the market.
This is a production SaaS.
Never build placeholder code.
Never build demo features.
Every feature should be scalable, maintainable and production ready.
________________________________________
PRODUCT
Product Name
Outrun
Tagline
Your AI Growth Partner.
Mission
Help businesses grow faster by understanding their business, identifying their biggest opportunities and executing high-impact growth strategies with AI.
Outrun is NOT:
• A CRM
• A Lead Database
• A Dashboard Tool
• A Sales Platform
Outrun IS:
An AI Growth Operating System.
Lead Generation is simply the first department.
Future departments include:
Marketing
SEO
Finance
Strategy
Customer Success
Business Intelligence
MissedCallIO Integration
Everything built today must make these future departments easy to integrate.
________________________________________
CORE PRODUCT PRINCIPLES
Every feature must satisfy ALL of these.
Reduce Work
Every feature should eliminate manual work.
Create Revenue
Every feature must contribute toward helping businesses grow.
Explain Everything
Every recommendation must explain WHY.
Simplicity
Never overwhelm users.
Premium
Every page should feel like premium enterprise software.
Fast
Users should never wait unnecessarily.
Human
Write naturally.
Avoid robotic wording.
Beautiful
Beautiful spacing.
Beautiful typography.
Beautiful animations.
Trustworthy
Never invent information.
Always distinguish facts from AI predictions.
Scale
Every component should be modular.
________________________________________
DESIGN SYSTEM
Theme
Modern
Minimal
Premium
Professional
Confident
Elegant
Calm
Every page should look like software worth paying for.
________________________________________
COLOUR PALETTE
Primary Background
Dark Charcoal
#181818
Secondary Background
#222222
Cards
#2B2B2B
Borders
#3A3A3A
Primary Text
#F5F5F5
Secondary Text
#B8B8B8
Muted Text
#909090
Success
#3DDC84
Warning
#F4B400
Error
#EA4335
Primary Accent
Use the Outrun brand colour derived from the logo.
Accent colours should be used sparingly.
The interface should feel premium rather than colourful.
________________________________________
TYPOGRAPHY
Use thin modern fonts.
Large headings.
Clean hierarchy.
Lots of whitespace.
Never crowd information.
Numbers should stand out.
Growth Scores should feel important.
Buttons should feel premium.
________________________________________
SPACING
Large padding.
Consistent margins.
Cards should breathe.
Every screen should feel calm.
Avoid clutter.
________________________________________
ROUNDED CORNERS
Rounded but professional.
Not playful.
________________________________________
SHADOWS
Very subtle.
Premium.
No heavy shadows.
________________________________________
ANIMATIONS
Every animation should have a purpose — purposeful and cinematic, not
gimmicky. Think Resend's landing page: deliberate, smooth, confident
motion, never particle effects or novelty for its own sake.
Page transitions
250ms
Card hover
150ms — plus a slower (300ms) lift + accent-glow border on
interactive/clickable cards specifically (marketing feature grids,
pricing tiers), via the Card component's `interactive` prop.
Buttons
100ms
Scroll reveals
Sections and cards fade + rise into view on scroll (600ms,
custom ease, once per page load) — the shared Reveal/RevealGroup/
RevealItem components in src/components/motion. Stagger sibling
items rather than animating them in unison.
Signature background
Two large, very slow-drifting blurred gradient blobs (20-30s loops)
behind hero-style sections — the AuroraBackground component. Subtle,
never distracting from the content in front of it.
Gradient text
The .text-gradient-signature utility (violet → cyan, slow shimmer) —
reserve for a single emphasized word per headline, not whole
sentences.
Loading
Elegant skeleton loaders.
Reduced motion
Every animation must degrade gracefully under prefers-reduced-motion
(fade only, no transforms/drift) — see the reduceMotion checks in
src/components/motion and the global CSS override in globals.css.
________________________________________
LOADING EXPERIENCE
Never show empty screens.
Instead show:
AI is analysing your business...
Finding qualified companies...
Researching prospects...
Preparing recommendations...
Generating personalised outreach...
Users should always know what Outrun is doing.
________________________________________
EMPTY STATES
Never display:
"No Data"
Instead explain:
You haven't created your first campaign yet.
Let's build one together.
Button
Create Campaign
________________________________________
ERROR STATES
Friendly.
Professional.
Explain what happened.
Explain how to fix it.
Offer retry.
Never expose stack traces.
________________________________________
PRODUCT CONSTITUTION
Claude must NEVER build features that violate these principles.
Never copy competitors.
Never create unnecessary dashboards.
Never make users configure dozens of settings.
Never require technical knowledge.
Never add complexity because competitors have it.
Never interrupt users unnecessarily.
Never require more than three clicks to perform common tasks.
Never force users to learn the software.
The software should feel obvious.
________________________________________
THE NORTH STAR
Every screen should answer ONE question.
"What is the next best thing this business should do to grow?"
If the screen does not answer that question...
Redesign it.
________________________________________
THE THREE WOW MOMENTS
WOW #1
The user finishes onboarding.
Outrun generates a personalised Growth Blueprint that feels like a consultant spent hours analysing their business.
________________________________________
WOW #2
The AI has already:
Found prospects.
Researched them.
Ranked them.
Generated personalised outreach.
Prepared a campaign.
The user realises most of the work is already done.
________________________________________
WOW #3
The Dashboard.
Instead of charts...
The user sees:
Good Morning, [First Name].
Today's Growth Score
82/100
Today's Mission
Launch your Construction Campaign.
Expected Pipeline
$18,000
Estimated Time
14 minutes
Potential Impact
High
Button
Launch Campaign
The user immediately knows what to do.
________________________________________
PRODUCT PERSONALITY
Outrun should feel like:
An experienced growth consultant.
A trusted business advisor.
An executive assistant.
Never like:
A chatbot.
A spreadsheet.
A reporting tool.
________________________________________
AI BEHAVIOUR
Every AI response must:
Be concise.
Be actionable.
Be evidence-based.
Clearly separate:
Facts
Predictions
Recommendations
Never present predictions as certainty.
Always explain confidence.
________________________________________
PERFORMANCE
Landing Page
Under 2 seconds.
Dashboard
Under 1 second after data is available.
Search
Under 3 seconds.
AI responses should stream where possible.
The application should feel instant.
________________________________________
CODING STANDARDS
Use production-grade architecture.
Strong typing.
Reusable components.
Clear separation of concerns.
Modular services.
Comprehensive error handling.
Well-documented code.
Consistent naming conventions.
Security by default.
Build every feature with future expansion in mind.
Do not sacrifice maintainability for speed of implementation.
________________________________________
SUCCESS METRIC
If a business owner can sign up, understand their business better than before, discover qualified opportunities, generate personalised outreach and feel confident about their next growth step within five minutes, Version 1 has achieved its primary objective.
Everything else is secondary.
