import Link from "next/link";
import { ArrowRight, BookOpen, Layers, Map, MessageCircle, Smartphone, Stethoscope, Target, Timer } from "lucide-react";
import { SouthernCross } from "@/components/SouthernCross";
import { ContrastTable } from "@/components/ContrastTable";
import { AppCta, StandaloneRedirect } from "@/components/site/client";
import { CONTRASTS, topicName } from "@/lib/content";
import { COUNTS } from "@/lib/site-counts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// One real row from a few topics, to show the India vs Australia idea with actual content.
const SAMPLE = ["cardiology", "infectious-disease", "antenatal-care", "mental-health-law"].flatMap((topic) => {
  const rows = CONTRASTS.find((c) => c.topic === topic)?.rows ?? [];
  const row = rows.find((r) => r.aspect === "STEMI reperfusion") ?? rows[0];
  return row ? [{ ...row, aspect: `${topicName(topic)}: ${row.aspect}` }] : [];
});

const PART1 = [
  {
    icon: BookOpen,
    title: "A guided course",
    body: `${COUNTS.lessons} short lessons across all ${COUNTS.topics} AMC topics, each ending with a quiz and flashcards. Start at the top and it tells you what to study next.`,
  },
  {
    icon: Target,
    title: "AMC-style questions",
    body: `${COUNTS.questions} hand-written one-best-answer questions with a note on every option. When you run out, the AI writes fresh ones on any topic, or from your own PDF notes.`,
  },
  {
    icon: Timer,
    title: "Timed mock exams",
    body: "30, 75 or 150 questions at real exam pace, with the AMC's no-going-back rule if you want it, and a report by discipline at the end.",
  },
  {
    icon: Layers,
    title: "Spaced-repetition flashcards",
    body: `${COUNTS.cards} cards to start, more added as you finish lessons, and your own decks made from a PDF. Reviews are scheduled so you see each card just before you'd forget it.`,
  },
];

const FAQ = [
  {
    q: "Is Southward free?",
    a: "Yes, while we're in early access. Create an account and everything is open. AI features have a fair daily limit so the service stays up for everyone.",
  },
  {
    q: "Is this an official AMC product?",
    a: "No. Southward is an independent study aid and isn't affiliated with or endorsed by the Australian Medical Council. For fees, eligibility and exam rules, always check amc.org.au.",
  },
  {
    q: "I'm still doing my MBBS. Is it too early?",
    a: "It's the best time to start. Southward maps each MBBS posting to the AMC topics it feeds, so the medicine you're learning in the wards counts twice. The study plan stretches to fit however long you have.",
  },
  {
    q: "Can I trust what the AI says?",
    a: "The course, question bank, flashcards and stations are written out in full and don't change from one visit to the next. The AI is there for extra questions, explanations and role-play. AI-written questions go through a separate check before you see them, but it can still be wrong, so treat current Australian guidelines as the final word.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. It's built phone-first. Add it to your home screen and it opens like an app, keeps working offline for pages you've studied, and syncs your progress to your laptop.",
  },
  {
    q: "I didn't study in India. Is it still useful?",
    a: "Yes. The AMC exams are the same for every international graduate. The India vs Australia notes are written for Indian MBBS graduates, but the differences they point out trip up most people trained outside Australia.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: SITE_NAME, url: SITE_URL, description: SITE_DESCRIPTION },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <StandaloneRedirect />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="bg-sky text-sky-ink">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-8 sm:py-20 md:grid-cols-[1.3fr_1fr]">
          <div className="rise">
            <p className="text-sm font-medium tracking-wide text-[var(--ochre)]">For Indian MBBS students and graduates</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.4rem]">
              Your way from MBBS to practising in Australia.
            </h1>
            <p className="mt-5 max-w-xl font-serif text-lg leading-relaxed text-sky-muted sm:text-xl">
              A complete prep for both AMC exams: a guided course, AMC-style questions, full mock exams and clinical
              stations with an AI patient. It shows you exactly where Australian practice differs from what you were taught.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <AppCta tone="ochre" />
              <Link href="/amc-pathway" className="inline-flex h-11 items-center gap-2 rounded-full px-5 font-medium hover:bg-white/10">
                How the AMC pathway works <ArrowRight size={16} />
              </Link>
            </div>
            <p className="mt-5 text-sm text-sky-muted">Free during early access. Works on your phone and laptop.</p>
          </div>
          <div className="mx-auto w-full max-w-[13rem] sm:max-w-xs md:max-w-sm">
            <SouthernCross
              stars={[
                { key: "found", label: "Foundations", detail: "", value: 90 },
                { key: "bank", label: "Question bank", detail: "", value: 70 },
                { key: "mcq", label: "MCQ readiness", detail: "", value: 55 },
                { key: "clin", label: "Clinical skills", detail: "", value: 35 },
                { key: "aus", label: "Australian context", detail: "", value: 80 },
              ]}
            />
            <p className="mt-2 text-center text-sm text-sky-muted">
              The Southern Cross brightens as you work through each part of your prep.
            </p>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="border-b border-line bg-surface">
        <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-3 sm:px-8 lg:grid-cols-6">
          {[
            [COUNTS.topics, "AMC topics"],
            [COUNTS.lessons, "lessons"],
            [COUNTS.questions, "hand-written MCQs"],
            [COUNTS.cards, "flashcards"],
            [COUNTS.stations, "clinical stations"],
            [COUNTS.reads, "Australia 101 reads"],
          ].map(([n, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block text-3xl font-semibold tabular-nums tracking-tight">{n}</span>
                <span className="text-sm text-muted">{label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* India vs Australia */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:items-start">
          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              What you learnt is right. The AMC just marks a different answer.
            </h2>
            <p className="mt-4 font-serif text-lg leading-relaxed text-muted">
              Most marks that Indian graduates lose aren&rsquo;t gaps in medicine. They come from answering the way it&rsquo;s done
              at home: a different first-line drug, a different screening age, a different law. Every topic in Southward sets
              the two side by side, so you learn the Australian answer on purpose.
            </p>
            <Link href="/topics" className="mt-5 inline-flex items-center gap-1.5 font-medium text-brand hover:underline">
              See the differences for all {COUNTS.topics} topics <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
            <ContrastTable rows={SAMPLE} />
          </div>
        </div>
      </section>

      {/* Features by exam part */}
      <section className="border-y border-line bg-sunk/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
          <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Everything for both exams, in one place</h2>

          <div className="mt-10 flex items-center gap-3">
            <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">Part 1: MCQ exam</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PART1.map((f) => (
              <Feature key={f.title} {...f} />
            ))}
          </div>

          <div className="mt-12 flex items-center gap-3">
            <span className="rounded-full bg-ochre-soft px-3 py-1 text-sm font-semibold text-ochre-ink">Part 2: Clinical exam</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-5 grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8 md:grid-cols-[auto_1fr]">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ochre-soft text-ochre-ink">
              <Stethoscope size={24} />
            </span>
            <div>
              <h3 className="text-xl font-semibold">{COUNTS.stations} clinical stations with an AI patient and examiner</h3>
              <p className="mt-2 max-w-3xl font-serif text-lg leading-relaxed text-muted">
                Two minutes of reading time, then eight minutes with a role-play patient you can type or talk to. They answer
                like a real patient would, out loud if you like. Then an examiner marks you the way the AMC does: a global
                rating, domain scores, what you covered and missed, and a model answer to compare against.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Feature
              icon={MessageCircle}
              title="A tutor that knows Australia"
              body="Ask about anything that didn't click, or tap &ldquo;why was I wrong?&rdquo; on any question. Answers follow Australian guidelines."
            />
            <Feature
              icon={Map}
              title="A plan sized to your exam date"
              body="Tell it when you're sitting the MCQ and it splits the time into four phases, with a milestones checklist from checking your medical school is eligible to the AMC Certificate."
            />
            <Feature
              icon={Smartphone}
              title="Made for your phone"
              body="Install it from your browser, study offline on the train, and pick up on your laptop exactly where you left off."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Tell it where you are", "Your MCQ date and, if you're still studying, which posting you're in. That sets your daily goal and your plan."],
            ["Do today's session", "A few flashcards, a set of questions and, now and then, a clinical station. Twenty minutes counts. Most people pass on steady daily work."],
            ["Know when you're ready", "Mock exams and your weakest topics show what to fix next. The Southern Cross fills in as each part of your prep comes together."],
          ].map(([t, b], i) => (
            <li key={t} className="rounded-2xl border border-line bg-surface p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-sky font-semibold text-[var(--ochre)]">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-2 font-serif leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Free guides */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8 sm:pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          <GuideCard href="/amc-pathway" title="The AMC Standard Pathway" body="Both exams, the MCQ format, and every step from eligibility to registration." />
          <GuideCard href="/topics" title={`All ${COUNTS.topics} AMC topics`} body="What each topic covers, the high-yield points, and where Australia does it differently." />
          <GuideCard href="/australia-101" title="Australia 101" body="Medicare, the PBS, consent, screening and cultural safety: what Australian graduates already know." />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-8 sm:py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-2xl leading-none text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 font-serif text-lg leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call */}
      <section className="bg-sky text-sky-ink">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Start today. Twenty minutes counts.</h2>
            <p className="mt-2 text-sky-muted">Free during early access. No card needed.</p>
          </div>
          <AppCta label="Create your free account" tone="ochre" />
        </div>
      </section>
    </>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof BookOpen; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon size={20} />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function GuideCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6 hover:border-brand">
      <span className="text-sm font-medium text-ochre-ink">Free guide</span>
      <h3 className="text-lg font-semibold group-hover:text-brand">{title}</h3>
      <p className="text-muted">{body}</p>
    </Link>
  );
}
