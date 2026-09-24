import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { AppCta } from "./client";

/** A public content page: breadcrumbs, a title and lede, then the body. */
export function SitePage({
  crumbs = [],
  title,
  lede,
  eyebrow,
  children,
  narrow,
}: {
  crumbs?: { href: string; label: string }[];
  title: string;
  lede?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={narrow ? "mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14" : "mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14"}>
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          {crumbs.map((c) => (
            <span key={c.href} className="flex items-center gap-1">
              <ChevronRight size={14} aria-hidden />
              <Link href={c.href} className="hover:text-ink">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <header className="mb-10 max-w-3xl">
        {eyebrow && <div className="mb-3">{eyebrow}</div>}
        <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight sm:text-[2.6rem]">{title}</h1>
        {lede && <p className="mt-4 font-serif text-lg leading-relaxed text-muted sm:text-xl">{lede}</p>}
      </header>
      {children}
    </div>
  );
}

/** The nudge at the end of every free guide: this page is the reading, the app is the practice. */
export function AppPromo({ title, body }: { title: string; body: string }) {
  return (
    <aside className="mt-14 flex flex-col items-start gap-5 rounded-3xl bg-sky p-6 text-sky-ink sm:p-10 md:flex-row md:items-center md:justify-between">
      <div className="max-w-xl">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sky-muted">{body}</p>
      </div>
      <AppCta tone="ochre" />
    </aside>
  );
}
