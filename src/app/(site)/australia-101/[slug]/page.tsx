import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPromo, SitePage } from "@/components/site/blocks";
import { Markdown } from "@/components/Markdown";
import { AUS_FACTS } from "@/lib/content";
import { factSlug } from "@/lib/site";

export const dynamicParams = false;

const bySlug = (slug: string) => AUS_FACTS.find((f) => factSlug(f) === slug);

export function generateStaticParams() {
  return AUS_FACTS.map((f) => ({ slug: factSlug(f) }));
}

/** The first paragraph as plain text, for search snippets. */
const excerpt = (md: string) =>
  md
    .split("\n\n")[0]
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .slice(0, 200);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = bySlug((await params).slug);
  if (!f) return {};
  return {
    title: `${f.title}: Australia 101`,
    description: excerpt(f.body),
    alternates: { canonical: `/australia-101/${factSlug(f)}` },
    openGraph: { type: "article" },
  };
}

export default async function Fact({ params }: { params: Promise<{ slug: string }> }) {
  const f = bySlug((await params).slug);
  if (!f) notFound();
  const i = AUS_FACTS.indexOf(f);
  const next = AUS_FACTS[(i + 1) % AUS_FACTS.length];
  const more = AUS_FACTS.filter((x) => x.category === f.category && x.id !== f.id);

  return (
    <SitePage
      narrow
      crumbs={[
        { href: "/australia-101", label: "Australia 101" },
        { href: `/australia-101/${factSlug(f)}`, label: f.title },
      ]}
      eyebrow={<span className="text-sm font-semibold text-ochre-ink">{f.category}</span>}
      title={f.title}
    >
      <article className="text-[1.08rem]">
        <Markdown>{f.body}</Markdown>
      </article>

      <nav aria-label="More reads" className="mt-12 grid gap-4 sm:grid-cols-2">
        {more.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold">More on {f.category.toLowerCase()}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {more.map((m) => (
                <li key={m.id}>
                  <Link href={`/australia-101/${factSlug(m)}`} className="text-brand hover:underline">
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link href={`/australia-101/${factSlug(next)}`} className="flex flex-col justify-center rounded-2xl border border-line bg-surface p-5 hover:border-brand">
          <span className="text-sm text-muted">Next read</span>
          <span className="font-semibold">{next.title} →</span>
        </Link>
      </nav>

      <AppPromo
        title="Turn reading into marks"
        body="Southward's questions and clinical stations test exactly these differences, so you answer the Australian way on exam day."
      />
    </SitePage>
  );
}
