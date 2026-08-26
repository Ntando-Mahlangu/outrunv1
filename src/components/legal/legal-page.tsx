import Link from "next/link";
import Image from "next/image";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-[var(--color-bg-primary)]">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-accent-text)] hover:underline"
        >
          <span aria-hidden>←</span>
          <Image src="/logo-mark.png" alt="" width={16} height={16} />
          Outrun
        </Link>

        <div className="mt-8 mb-8 rounded-[var(--radius-md)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">
          Draft — this page has not been reviewed by a lawyer. Do not rely on
          it as your final policy before launch.
        </div>

        <h1 className="text-3xl font-light tracking-tight text-[var(--color-text-primary)]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Last updated: {updated}</p>

        <div className="prose-legal mt-10 space-y-8">{children}</div>
      </div>
    </main>
  );
}

export function LegalSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {children}
      </div>
    </section>
  );
}
