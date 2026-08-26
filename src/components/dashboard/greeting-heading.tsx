"use client";

import { SplitHeading } from "@/components/motion/split-heading";

// Client wrapper around SplitHeading's per-word wordClassName function prop —
// SplitHeading is itself a client component, but DashboardPage (its caller)
// is an async Server Component, and a function prop can't cross that
// server→client boundary (React can't serialize a closure over the RSC
// wire). Building the function here, entirely client-side, instead of
// passing one down from the server component, is what actually fixes that —
// this component only ever receives plain, serializable string props.
export function GreetingHeading({ greeting, firstName }: { greeting: string; firstName: string }) {
  return (
    <SplitHeading
      as="h1"
      text={`${greeting}, ${firstName}.`}
      wordClassName={(i) => (i === 2 ? "text-gradient-signature" : "")}
      className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
    />
  );
}
