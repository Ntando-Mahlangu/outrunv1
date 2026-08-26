import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { ManageCookiesLink } from "@/components/legal/manage-cookies-link";
import { TERMS_UPDATED_LABEL } from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={TERMS_UPDATED_LABEL}>
      <LegalSection title="What we collect">
        <p>
          Account information you provide directly: your name, business email,
          and password (stored as a hash, never in plain text).
        </p>
        <p>
          Business information you share during onboarding: your business
          description, ideal customer, target markets, growth challenges, and
          goals.
        </p>
        <p>
          Content Outrun generates on your behalf: your Growth Blueprint,
          prospect research, and outreach messages.
        </p>
        <p>
          Billing information, handled entirely by our payment processor,
          Paddle — we never see or store your card details.
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          To provide the product: generating your Growth Blueprint, finding
          and scoring prospects, and writing outreach on your behalf.
        </p>
        <p>To process payments and manage your subscription.</p>
        <p>To send account-related email (verification, password reset, billing).</p>
        <p>We do not sell your data, and we do not use your business data to personalize another customer&apos;s experience.</p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          Anthropic processes your business information to generate your
          Growth Blueprint and prospect research.
        </p>
        <p>
          OpenStreetMap is used to search for prospect companies by default
          (no data is shared beyond the search terms themselves); Yelp or
          Google Places are used instead if your workspace has one of those
          integrations configured.
        </p>
        <p>Paddle processes payments and manages billing.</p>
        <p>Resend delivers transactional email.</p>
        <p>
          If you&apos;ve accepted analytics cookies (see &ldquo;Cookies&rdquo;
          below), Google Analytics — and Google Ads, if configured — receives
          aggregate usage data.
        </p>
        <p>We do not share your data with anyone else.</p>
      </LegalSection>

      <LegalSection title="Cookies" id="cookies">
        <p>
          Outrun uses two kinds of cookies. Essential cookies (session and
          sign-in, and remembering which workspace you&apos;re in) are always
          on — the product can&apos;t function without them, and they
          don&apos;t require consent. Analytics cookies (Google Analytics,
          and Google Ads if configured) are off by default and only ever set
          if you accept them in the cookie banner shown on your first visit.
        </p>
        <p>
          You can change your choice at any time: <ManageCookiesLink />.
        </p>
      </LegalSection>

      <LegalSection title="International data transfers">
        <p>
          Some of the providers listed above (including Anthropic, Google,
          Paddle, and Resend) may process data outside South Africa. Where
          that happens, we rely on those providers&apos; own data protection
          safeguards and standard contractual terms.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Data is encrypted in transit and at rest. Passwords are hashed, not
          stored in plain text. Access to production data is limited to what
          operating the service requires. No method of transmission or
          storage is 100% secure, and we can&apos;t guarantee absolute
          security.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          Depending on where you&apos;re located, you may have rights under
          POPIA (South Africa), GDPR (EU/UK), or similar laws to access,
          correct, export, or delete your personal information, and to
          object to or restrict certain processing. You can exercise any of
          these by contacting us at the email below; we&apos;ll respond
          within a reasonable time and consistent with applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Data retention and deletion">
        <p>
          We retain your data for as long as your account is active. You can
          request export or deletion of your data at any time by contacting
          us at outrunv1privacy@outlook.com.
        </p>
      </LegalSection>

      <LegalSection title="Children's privacy">
        <p>
          Outrun isn&apos;t directed at anyone under 18, and we don&apos;t
          knowingly collect personal information from children. If you
          believe a child has provided us information, contact us and
          we&apos;ll delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy from time to time. We&apos;ll post the
          updated version here with a new &ldquo;Last updated&rdquo; date.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about this policy: outrunv1privacy@outlook.com.</p>
      </LegalSection>
    </LegalPage>
  );
}
