import { createAuthClient } from "better-auth/react";
import {
  magicLinkClient,
  genericOAuthClient,
  twoFactorClient,
  emailOTPClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    genericOAuthClient(),
    emailOTPClient(),
    // docs/outrun/15 "AUTHENTICATION SECURITY — Optional MFA". Sign-in
    // pages read `data.twoFactorRedirect` off the signIn.email/social
    // response directly rather than this callback, since the redirect
    // needs to swap in a step within the same form, not navigate away.
    twoFactorClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
