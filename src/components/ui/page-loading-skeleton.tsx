import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Generic per-route `loading.tsx` fallback (docs/outrun/01 "LOADING STATES"
// — never leave the previous route's content on screen while a new one is
// still fetching). Without a loading.tsx, the App Router keeps rendering
// the page you navigated FROM until the one you navigated TO finishes all
// its data fetching — the sidebar's active link updates instantly, but the
// content lags behind and can look like the wrong page loaded entirely.
// Every top-level (app) route gets this same shape rather than a bespoke
// skeleton per page — close enough to each page's real layout (heading +
// a few content blocks) to read as "this page is loading," not "this is
// broken."
export function PageLoadingSkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card>
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      </Card>

      <Card>
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </Card>
    </div>
  );
}
