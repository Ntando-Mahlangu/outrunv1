"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/seo", label: "SEO" },
  { href: "/growth-partner", label: "Growth Partner" },
  { href: "/memory", label: "AI Memory" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/brand-voice", label: "Brand Voice" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/api-keys", label: "API Keys" },
  { href: "/settings/webhooks", label: "Webhooks" },
  { href: "/billing", label: "Billing" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-[var(--radius-md)] px-4 py-2 text-sm transition-colors duration-100",
              active
                ? "bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-card)] hover:text-[var(--color-text-primary)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
