import type { Metadata } from "next";
import Link from "next/link";
import { AppPromo, SitePage } from "@/components/site/blocks";
import { AUS_FACTS } from "@/lib/content";
import { factSlug } from "@/lib/site";

export const metadata: Metadata = {
  title: "Australia 101 for international medical graduates",
  description:
    "Short reads on how Australian medicine works: Medicare and the PBS, prescribing, consent and the law, screening, immunisation, Aboriginal and Torres Strait Islander health and more.",
  alternates: { canonical: "/australia-101" },
};

export default function Australia101() {
  const categories = [...new Set(AUS_FACTS.map((f) => f.category))];
  return (
    <SitePage
      crumbs={[{ href: "/australia-101", label: "Australia 101" }]}
      title="Australia 101"
      lede="The things Australian graduates absorb without noticing, and that international graduates lose marks on: how the health system works, the law, prescribing, screening and culture. Each one is a five-minute read."
    >
      <div className="columns-1 gap-6 md:columns-2 lg:columns-3">
        {categories.map((c) => (
          <section key={c} className="mb-6 break-inside-avoid rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ochre-ink">{c}</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {AUS_FACTS.filter((f) => f.category === c).map((f) => (
                <li key={f.id}>
                  <Link href={`/australia-101/${factSlug(f)}`} className="font-medium hover:text-brand">
                    {f.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <AppPromo
        title="Learn it where it's tested"
        body="In the app, every topic points out the Australian answer, and the questions test it the way the AMC does."
      />
    </SitePage>
  );
}
