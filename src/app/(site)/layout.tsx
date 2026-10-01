import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteHeader } from "@/components/site/SiteHeader";
import { APP_PATH, CONTACT_EMAIL } from "@/lib/site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

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
      {/* Phones: taller rows, so neighbouring links aren't easy to mis-tap. */}
      <ul className="mt-2 flex flex-col text-sm sm:mt-3 sm:gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-block py-2 text-muted hover:text-ink sm:py-0">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
