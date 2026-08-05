"use client";

import { useEffect } from "react";
import { trackSignUpConversion } from "@/lib/analytics";

// Rendered once, from src/app/welcome/page.tsx, on the one branch of that
// page that only a brand-new membership (no Growth Blueprint yet) ever
// reaches. The localStorage guard covers the one way that page can still
// render twice for the same person — they abandon onboarding and come back
// to /welcome later — so the sign-up conversion is never double-counted.
export function SignupConversion({ userId }: { userId: string }) {
  useEffect(() => {
    const key = `outrun_signup_tracked_${userId}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
    trackSignUpConversion();
  }, [userId]);

  return null;
}
