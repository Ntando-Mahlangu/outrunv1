import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins/magic-link";
import { genericOAuth, microsoftEntraId } from "better-auth/plugins/generic-oauth";
import { twoFactor } from "better-auth/plugins";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logLoginForUser, logFailedLoginForEmail } from "@/lib/audit/log-login-events";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

const microsoftConfigured = Boolean(
  process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
);

// Better Auth only trusts baseURL's own origin by default — it rejects
// every other origin with "Invalid origin", even a legitimate one. The
// production domain is reachable at both the apex and "www" once a
// custom domain is attached (outrunv1.online's own canonical URL, see
// src/app/layout.tsx's SITE_URL, is apex-only), so without an explicit
// list here, whichever variant doesn't exactly match BETTER_AUTH_URL
// fails real sign-ups/sign-ins for no reason a user did anything wrong.
const productionOrigins = ["https://outrunv1.online", "https://www.outrunv1.online"];
const configuredOrigin = process.env.BETTER_AUTH_URL;
const trustedOrigins = Array.from(
  new Set([...productionOrigins, ...(configuredOrigin ? [configuredOrigin] : [])]),
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins,

  emailAndPassword: {
    enabled: true,
    // docs/outrun/03 "AUTHENTICATION" requirements — a session isn't
    // issued on sign-up while this is true (Better Auth returns
    // { token: null } instead), so src/app/sign-up/page.tsx sends the
    // user to /verify-email rather than assuming one exists.
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Outrun password",
        text: `Reset your password: ${url}\n\nIf you didn't request this, you can ignore this email.`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // Clicking the verification link signs the user straight in rather
    // than dropping them back at /sign-in a second time — sign-up's own
    // callbackURL (see the sign-up page) carries them on to /welcome.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your Outrun account",
        text: `Confirm your email to finish setting up Outrun: ${url}`,
      });
    },
  },

  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,

  // docs/outrun/11 "Encrypted Credential Storage" / docs/outrun/15
  // "Encrypt: Tokens, Credentials" / Article XII — Account.accessToken,
  // refreshToken, and idToken would otherwise sit in Postgres as plain
  // text. AES-256-GCM, keyed off BETTER_AUTH_SECRET; Better Auth
  // transparently decrypts on read (account info, token refresh).
  account: {
    encryptOAuthTokens: true,
  },

  plugins: [
    // docs/outrun/03 "AUTHENTICATION — Magic Link". Reuses the same
    // sendEmail() seam as password reset/verification; a fresh account
    // is created automatically for an email that doesn't exist yet
    // (disableSignUp defaults to false), so this doubles as a
    // password-less sign-up path too.
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Your Outrun sign-in link",
          text: `Sign in to Outrun: ${url}\n\nIf you didn't request this, you can ignore this email.`,
        });
      },
    }),
    // docs/outrun/03 "AUTHENTICATION — Microsoft". Microsoft has no
    // first-class socialProviders entry in Better Auth (unlike Google);
    // it ships as a genericOAuth preset instead.
    ...(microsoftConfigured
      ? [
          genericOAuth({
            config: [
              microsoftEntraId({
                clientId: process.env.MICROSOFT_CLIENT_ID!,
                clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
                tenantId: process.env.MICROSOFT_TENANT_ID || "common",
              }),
            ],
          }),
        ]
      : []),
    // docs/outrun/15 "AUTHENTICATION SECURITY — Optional MFA". TOTP only
    // (no email-OTP factor) — an authenticator app is the strongest
    // factor an owner-run business can adopt without extra infrastructure.
    twoFactor({
      issuer: "Outrun",
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
  },

  // docs/outrun/15 "RATE LIMITING" — Authentication. Better Auth already
  // ships stricter built-in defaults for sign-in/sign-up (3 per 10s) and
  // password-reset/verification (3 per 60s); explicitly enabling this
  // (rather than relying on its isProduction-only default) and pointing
  // it at Postgres (rather than the in-memory default) means limits hold
  // across serverless instances and restarts, not just one process.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
  },

  databaseHooks: {
    user: {
      create: {
        // Every account owns exactly one Organization from the moment it
        // exists — business details (industry, ICP, goals...) get filled
        // in by the Business Discovery onboarding flow, not here.
        after: async (user) => {
          await prisma.organization.create({
            data: {
              name: `${user.name}'s Workspace`,
              memberships: {
                create: { userId: user.id, role: "OWNER" },
              },
            },
          });
        },
      },
    },
  },

  // docs/outrun/12 "AUDIT LOG" / docs/outrun/15 "AUTHENTICATION SECURITY" —
  // both list logins as a required audit category. This runs after every
  // request regardless of path, so it has to filter itself rather than
  // relying on a plugin-style matcher.
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (newSession) {
        // The credential handler creates a session unconditionally, then
        // the twoFactor plugin's own after-hook deletes it and nulls this
        // out when the account has 2FA enabled — but that plugin hook runs
        // AFTER this one in the chain, so at this point the doomed session
        // is still visible here. Recognize the same pending-2FA case
        // directly (matching that plugin's own check) rather than logging
        // a login that hasn't actually completed yet.
        const user = newSession.user as { id: string; twoFactorEnabled?: boolean };
        const pendingTwoFactor = ctx.path === "/sign-in/email" && Boolean(user.twoFactorEnabled);
        if (!pendingTwoFactor) {
          await logLoginForUser(user.id);
        }
      }

      if (ctx.path === "/sign-in/email" && isAPIError(ctx.context.returned)) {
        const email = (ctx.body as { email?: unknown } | undefined)?.email;
        if (typeof email === "string") {
          await logFailedLoginForEmail(email);
        }
      }
    }),
  },
});

export const isGoogleAuthEnabled = googleConfigured;
export const isMicrosoftAuthEnabled = microsoftConfigured;
