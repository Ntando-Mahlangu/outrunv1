"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

// docs/outrun/04 "Left Sidebar" lists many future sections (Prospects,
// Campaigns, Outreach, Growth Reviews, AI Memory...). Per "FUTURE MODULE
// PLACEHOLDERS — reserve dashboard locations, do not build them now", we
// only list routes that exist today; add entries here as each ships.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/blueprint", label: "Growth Blueprint" },
  { href: "/tasks", label: "Tasks" },
  { href: "/goals", label: "Goals" },
  { href: "/prospects", label: "Prospects" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/growth-partner", label: "Growth Partner" },
  { href: "/memory", label: "AI Memory" },
  { href: "/settings/team", label: "Team" },
];

// Grouped separately under a "Settings" label rather than flattened in with
// everything above — these are the configure-once, check-rarely pages.
const SETTINGS_NAV_ITEMS = [
  { href: "/seo", label: "SEO" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/webhooks", label: "Webhooks" },
  { href: "/settings/api-keys", label: "API Keys" },
  { href: "/settings/brand-voice", label: "Brand Voice" },
  { href: "/billing", label: "Billing" },
];

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-[var(--radius-md)] px-4 py-2 text-sm transition-colors duration-100",
        active
          ? "bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-card)] hover:text-[var(--color-text-primary)]",
      )}
    >
      {label}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <nav className="space-y-6">
      <div className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} pathname={pathname} />
        ))}
      </div>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-expanded={settingsOpen}
          className="flex w-full items-center justify-between rounded-[var(--radius-md)] px-4 py-1 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          Settings
          <svg
            viewBox="0 0 24 24"
            className={cn("size-3.5 transition-transform duration-150", settingsOpen && "rotate-180")}
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {settingsOpen && (
          <div className="space-y-1">
            {SETTINGS_NAV_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
