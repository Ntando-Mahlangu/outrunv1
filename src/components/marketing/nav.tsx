import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/brand/logo";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />

        <nav className="hidden items-center gap-8 text-sm text-[var(--color-text-secondary)] sm:flex">
          <a href="#features" className="hover:text-[var(--color-text-primary)]">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-[var(--color-text-primary)]">
            How It Works
          </a>
          <a href="#pricing" className="hover:text-[var(--color-text-primary)]">
            Pricing
          </a>
          <a href="#faq" className="hover:text-[var(--color-text-primary)]">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="hidden text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] sm:block"
          >
            Sign In
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
            Start Now
          </Link>
        </div>
      </div>
    </header>
  );
}
