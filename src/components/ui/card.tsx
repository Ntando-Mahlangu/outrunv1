import * as React from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  /** Hover lift + accent glow — for clickable/feature cards (pricing,
   * feature grids), not data-display cards throughout the dashboard. */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
        interactive &&
          "transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-accent)]/50 hover:shadow-[var(--shadow-glow)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-6 space-y-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "text-2xl font-light tracking-tight text-[var(--color-text-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-[var(--color-text-secondary)]", className)}
      {...props}
    />
  );
}
