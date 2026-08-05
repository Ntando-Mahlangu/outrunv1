import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { API_VERSION } from "@/lib/api-version";

const PROTECTED_PREFIXES = [
  "/welcome",
  "/dashboard",
  "/onboarding",
  "/blueprint",
  "/prospects",
  "/campaigns",
  "/memory",
  "/growth-partner",
  "/seo",
  "/settings",
  "/billing",
];

// docs/outrun/15 "SECURITY BY DEFAULT". Paddle's checkout overlay
// (@paddle/paddle-js) is the one third-party surface this app embeds or
// calls out to — every other integration (Google/Microsoft sign-in) is a
// full-page redirect, not something rendered inside this origin, so it
// needs no CSP allowance here.
// docs/outrun/15 — analytics is opt-in via NEXT_PUBLIC_GA_MEASUREMENT_ID, so
// the CSP only widens for these Google domains when it's actually configured
// (see src/components/analytics/analytics-scripts.tsx). 'strict-dynamic'
// already covers script loading for browsers that support it; the explicit
// googletagmanager.com host is Google's documented fallback for the ones
// that don't (older Safari).
const ANALYTICS_ENABLED = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

function buildCsp(nonce: string): string {
  // React's dev mode reconstructs component stacks via eval() for better
  // error messages — "React will never use eval() in production mode" (its
  // own console warning) is the guarantee that makes this safe to scope to
  // non-production only.
  const analyticsScriptSrc = ANALYTICS_ENABLED ? " https://www.googletagmanager.com" : "";
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://cdn.paddle.com${analyticsScriptSrc}`
      : `script-src 'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic' https://cdn.paddle.com${analyticsScriptSrc}`;

  const analyticsConnectSrc = ANALYTICS_ENABLED
    ? " https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net"
    : "";
  const analyticsImgSrc = ANALYTICS_ENABLED
    ? " https://www.googletagmanager.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://www.googleadservices.com"
    : "";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: https://cdn.paddle.com${analyticsImgSrc}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'self' https://*.paddle.com",
    "frame-ancestors 'none'",
    `connect-src 'self' https://*.paddle.com${analyticsConnectSrc}`,
    "upgrade-insecure-requests",
  ].join("; ");
}

// Fast redirect based on cookie presence only. The actual session is
// re-verified server-side via auth.api.getSession() on every protected
// page — this proxy never grants access by itself.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A fresh nonce per request, threaded to the root layout via a request
  // header so Next can nonce its own injected scripts against the same CSP
  // this proxy sets on the response — see docs/outrun/15's CSP requirement.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  function withSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    );
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
    return response;
  }

  // docs/outrun/11 "API DESIGN — Clear versioning." Stamped here rather
  // than in every route.ts so it can never drift on a route someone forgets
  // to update — every /api/* response carries it, including the ones
  // Better Auth's catch-all generates.
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-API-Version", API_VERSION);
    return withSecurityHeaders(response);
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (isProtected) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      const signInUrl = new URL("/sign-in", request.url);
      return withSecurityHeaders(NextResponse.redirect(signInUrl));
    }
  }

  return withSecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
  matcher: [
    // Every route except Next's own static asset endpoints and common
    // static file extensions — see Next.js's own CSP-with-nonce guide,
    // which uses this same exclusion pattern.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
