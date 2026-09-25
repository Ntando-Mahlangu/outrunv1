import Image from "next/image";

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* logo-mark.png is a light-on-transparent asset made for the old
          dark theme; inverting it turns it into a dark mark for the light
          theme without needing a second exported asset. */}
      <Image src="/logo-mark.png" alt="" width={size} height={size} priority className="invert" />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        Outrun
      </span>
    </span>
  );
}
