import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AppCta } from "@/components/site/client";
import { APP_PATH, CONTACT_EMAIL, PUBLIC_NAV } from "@/lib/site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <Logo href="/" />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {PUBLIC_NAV.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full px-3 py-2 text-[0.95rem] text-muted hover:bg-sunk hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={APP_PATH} className="hidden rounded-full px-3 py-2 text-[0.95rem] text-muted hover:text-ink sm:block">
              Sign in
            </Link>
            <AppCta size="sm" />
            <details className="group relative md:hidden">
              <summary aria-label="Menu" className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full hover:bg-sunk [&::-webkit-details-marker]:hidden">
                <Menu size={20} />
              </summary>
              <nav aria-label="Main" className="absolute right-0 top-11 flex w-56 flex-col rounded-2xl border border-line bg-surface p-2 shadow-xl">
                {PUBLIC_NAV.map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-xl px-3 py-2.5 hover:bg-sunk">
                    {l.label}
                  </Link>
                ))}
                <Link href={APP_PATH} className="rounded-xl px-3 py-2.5 hover:bg-sunk">
                  Sign in
                </Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-sunk/60">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo href="/" />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              An independent study aid for the Australian Medical Council exams. Not affiliated with or endorsed by the AMC,
              Ahpra or the Medical Board of Australia. Written for exam practice, not patient care.
            </p>
          </div>
          <FooterList
            title="Free guides"
            links={[
              { href: "/amc-pathway", label: "The AMC Standard Pathway" },
              { href: "/topics", label: "All 52 AMC topics" },
              { href: "/australia-101", label: "Australia 101" },
            ]}
          />
          <FooterList
            title="Southward"
            links={[
              { href: APP_PATH, label: "Open the app" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              ...(CONTACT_EMAIL ? [{ href: `mailto:${CONTACT_EMAIL}`, label: "Contact" }] : []),
            ]}
          />
        </div>
      </footer>
    </div>
  );
}

function FooterList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-muted hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
