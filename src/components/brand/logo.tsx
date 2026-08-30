import Image from "next/image";

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/logo-mark.png" alt="" width={size} height={size} priority />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-medium tracking-tight text-[var(--color-text-primary)]">
          Outrun
        </span>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Outrun
        </span>
      </span>
    </span>
  );
}
