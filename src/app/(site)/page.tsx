import Link from "next/link";
import { BookOpen, Layers, Map, MessageCircle, Smartphone, Stethoscope, Target, Timer } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { ContrastTable } from "@/components/ContrastTable";
import { AppCta, StandaloneRedirect } from "@/components/site/client";
import { Journey } from "@/components/site/home/Journey";
import { Roadmap } from "@/components/site/home/Roadmap";
import { MascotDrop, MascotHandoff } from "@/components/site/home/MascotHandoff";
import { Features } from "@/components/site/home/Features";
import { Starfield } from "@/components/site/home/Starfield";
import { Globe } from "@/components/site/home/Globe";
import { Checklist, QuestionCard, StationTimer } from "@/components/site/home/Illustrations";
import { CONTRASTS } from "@/lib/contrasts";
import { topicName } from "@/lib/content";
import { QUESTIONS } from "@/lib/bank/questions";
import { STATIONS } from "@/lib/bank/stations";
import { MILESTONES } from "@/lib/plan";
import { COUNTS } from "@/lib/site-counts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// One real row from a few topics, to show the India vs Australia idea with actual content.
const SAMPLE = ["cardiology", "infectious-disease", "antenatal-care", "mental-health-law"].flatMap((topic) => {
  const rows = CONTRASTS.find((c) => c.topic === topic)?.rows ?? [];
  const row = rows.find((r) => r.aspect === "STEMI reperfusion") ?? rows[0];
  return row ? [{ ...row, aspect: `${topicName(topic)}: ${row.aspect}` }] : [];
});

// Real content for the chapter illustrations, looked up by id so it can't drift from the bank.
const QUESTION = QUESTIONS.find((q) => q.id === "med-030")!;
const STATION = STATIONS.find((s) => s.id === "st-cardiology-1")!;
const milestones = (ids: string[]) => ids.map((id) => MILESTONES.find((m) => m.id === id)!);
const FIRST_STEPS = milestones(["m-understand", "m-wdoms", "m-docs", "m-portfolio"]);
const LAST_STEPS = milestones(["m-english", "m-certificate"]);

// Each tip is the mascot's one piece of advice for that step, taken from the pathway guide and exam format.
const CHAPTERS = [
  { id: "eligible", label: "Check you're eligible", tip: "Start EPIC verification as soon as you're eligible. It can take weeks." },
  { id: "mcq", label: "Part 1: the MCQ exam", tip: "Wrong answers don't lose marks, so never leave one blank." },
  { id: "differences", label: "The Australian answer", tip: "The exam marks the Australian answer, even when yours is right at home." },
  { id: "clinical", label: "Part 2: the clinical exam", tip: "Use both reading minutes to plan every task before you walk in." },
  { id: "registration", label: "Certificate and registration", tip: "Book your English test close to registration. Results expire." },
];
const tipFor = (id: string) => CHAPTERS.find((c) => c.id === id)!.tip;

const INSIDE = [
  { icon: BookOpen, title: "A guided course", body: `${COUNTS.lessons} short lessons across all ${COUNTS.topics} topics, each ending in a quiz.` },
  { icon: Target, title: "AMC-style questions", body: `${COUNTS.questions} hand-written, plus fresh AI questions on any topic or from your own PDF.` },
  { icon: Timer, title: "Timed mock exams", body: "30, 75 or 150 questions at real exam pace, with a report by discipline." },
  { icon: Layers, title: "Spaced-repetition flashcards", body: `${COUNTS.cards} cards, and your own decks made from a PDF.` },
  { icon: Stethoscope, title: "Clinical stations", body: `${COUNTS.stations} stations with an AI patient and an AMC-style examiner.` },
  { icon: MessageCircle, title: "A tutor that knows Australia", body: "Ask about anything that didn't click, or why an answer was wrong." },
  { icon: Map, title: "A plan sized to your exam date", body: "Four phases from today to your MCQ, and a milestones checklist." },
  { icon: Smartphone, title: "Made for your phone", body: "Install it, study offline, and pick up on your laptop where you left off." },
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

      <Journey
        logo={
          <>
            {/* The name first, alone under the night sky. */}
            <h1 className="flex flex-col items-center">
              <span className="sr-only">Southward: AMC exam prep for Indian medical graduates</span>
              <span aria-hidden className="hero-word block select-none font-serif font-light leading-none">
                Southward
              </span>
            </h1>
            <p className="hero-follow mt-5 max-w-xl text-center font-serif text-lg italic leading-relaxed text-sky-muted sm:text-xl">
              Your way from MBBS to practising in Australia
            </p>
            <div className="hero-follow mt-8 flex flex-wrap items-center justify-center gap-3">
              <AppCta />
              <Link href="#roadmap" className="inline-flex h-11 items-center rounded-full border border-white/15 px-5 text-[0.95rem] text-sky-ink/90 transition-colors hover:border-white/30 hover:bg-white/5">
                Skip to the roadmap
              </Link>
            </div>
            <p className="hero-follow scroll-cue absolute bottom-8 flex flex-col items-center gap-2 text-sm text-sky-muted">
              Scroll to fly south
              <span aria-hidden className="h-8 w-5 rounded-full border border-white/30 p-1">
                <span className="scroll-dot block h-1.5 w-1.5 translate-x-[3px] rounded-full bg-sky-ink" />
              </span>
            </p>
          </>
        }
        arrival={
          <>
            {/* The greeting is exactly as wide as the title: mascot flush with its left edge, bubble with its right. */}
            <div className="flex w-fit max-w-full flex-col">
              <h2 className="text-balance text-center font-serif text-5xl font-light leading-tight tracking-tight sm:text-6xl">
                Welcome to Australia.
              </h2>
              {/* w-0 + min-w-full: the row takes the title's width rather than widening the block to fit the bubble. */}
              <div className="mt-8 flex w-0 min-w-full items-center gap-4 sm:gap-5">
                <div data-welcome-mascot className="w-24 shrink-0 sm:w-28">
                  <Mascot wave className="w-full" />
                </div>
                {/* Nudged down a little: the mascot's face sits just below the middle of its drawing. */}
                <p className="bubble mt-4 min-w-0 flex-1 px-4 py-3 text-[0.95rem] leading-snug sm:px-5 sm:py-3.5 sm:text-base">
                  G&rsquo;day! That&rsquo;s the flight. Now let&rsquo;s walk the road to getting you here, one step at a time.
                  <span className="bubble-tail left -left-[0.5rem] top-[calc(50%-0.45rem)]" />
                </p>
              </div>
            </div>
          </>
        }
        fallback={<Globe className="w-full max-w-md" />}
      />

      <MascotHandoff />
      <Roadmap steps={CHAPTERS}>
        <Chapter
          id="eligible"
          index={0}
          title="Check the pathway is open to you"
          body={
            <>
              Your medical school has to be listed in the World Directory of Medical Schools with a note that makes it
              acceptable to the AMC. After graduation you open an AMC portfolio, and your degree is verified with your
              university through EPIC. That can take weeks, so start as soon as you&rsquo;re eligible.
            </>
          }
          aside={
            <>
              Southward keeps the whole checklist for you, from here to the AMC Certificate.{" "}
              <Link href="/amc-pathway" className="text-sky-ink underline underline-offset-4 hover:text-[var(--ochre)]">
                Read the pathway guide
              </Link>
            </>
          }
        >
          <Checklist items={FIRST_STEPS} />
        </Chapter>

        <Chapter
          id="mcq"
          index={1}
          title="Part 1, the MCQ exam"
          body={
            <>
              150 one-best-answer questions in three and a half hours: about 84 seconds each, with no going back to change an
              answer. You can sit it at a test centre in India.
            </>
          }
          aside={
            <>
              Southward has {COUNTS.lessons} lessons across all {COUNTS.topics} topics, {COUNTS.questions} hand-written
              questions with a note on every option, timed mocks at the real pace and {COUNTS.cards} flashcards.
            </>
          }
        >
          <QuestionCard q={QUESTION} />
        </Chapter>

        <Chapter
          id="differences"
          index={2}
          title="Learn the answer Australia marks"
          body={
            <>
              Most marks Indian graduates lose aren&rsquo;t gaps in medicine. They come from answering the way it&rsquo;s done
              at home: a different first-line drug, screening age or law. Every topic sets the two side by side.
            </>
          }
          aside={
            <Link href="/topics" className="text-sky-ink underline underline-offset-4 hover:text-[var(--ochre)]">
              See the differences for all {COUNTS.topics} topics
            </Link>
          }
        >
          <div className="rounded-3xl bg-surface p-3 text-ink sm:p-5">
            <ContrastTable rows={SAMPLE.slice(0, 1)} />
          </div>
        </Chapter>

        <Chapter
          id="clinical"
          index={3}
          title="Part 2, the clinical exam"
          body={
            <>
              A circuit of stations with role-play patients. Two minutes to read the brief, then eight to take a history,
              examine, explain and manage.
            </>
          }
          aside={
            <>
              Southward has {COUNTS.stations} stations with an AI patient you can type or talk to, then an examiner who marks
              you the way the AMC does, with a model answer to compare against.
            </>
          }
        >
          <StationTimer station={STATION} />
        </Chapter>

        <Chapter
          id="registration"
          index={4}
          title="The AMC Certificate, then registration"
          body={
            <>
              Pass both exams and you receive the AMC Certificate. With it and the English language standard, you apply to
              the Medical Board of Australia through Ahpra. General registration usually follows a period of supervised
              practice.
            </>
          }
          aside={<>Southward tracks these with the rest of your checklist, so nothing is left to the last minute.</>}
        >
          <Checklist items={LAST_STEPS} />
        </Chapter>
      </Roadmap>

      {/* What's inside: the mascot drops from the end of the roadmap onto a road, and walks it one feature at a time. */}
      <MascotDrop />
      <Features
        heading={
          <>
            {/* Short screens drop the eyebrow and shrink the heading, so the feature and the road both fit. */}
            <p className="text-sm text-[var(--ochre)] [@media(max-height:700px)]:hidden">What you&rsquo;ll have with you</p>
            <h2 className="mt-2 text-balance font-serif text-3xl font-light leading-tight tracking-tight sm:text-5xl [@media(max-height:700px)]:mt-0 [@media(max-height:700px)]:text-[1.6rem]">
              Everything for both exams, in one app
            </h2>
          </>
        }
        items={INSIDE.map(({ icon: Icon, title, body }) => ({ title, body, icon: <Icon size={26} strokeWidth={1.6} aria-hidden /> }))}
      />

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-8 sm:pb-28">
        <div className="grid gap-4 md:grid-cols-3">
          <GuideCard href="/amc-pathway" title="The AMC Standard Pathway" body="Both exams, the MCQ format, and every step from eligibility to registration." />
          <GuideCard href="/topics" title={`All ${COUNTS.topics} AMC topics`} body="What each topic covers, the high-yield points, and where Australia does it differently." />
          <GuideCard href="/australia-101" title="Australia 101" body="Medicare, the PBS, consent, screening and cultural safety: what Australian graduates already know." />
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-8 sm:py-20">
          <h2 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">Questions</h2>
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

      {/* Closing call, under the same sky */}
      {/* On the same night as the rest of the page: no band of its own, just stars and a soft glow that fade out at the
          edges, so it never starts or stops at a line. */}
      <section data-header="night" className="relative overflow-hidden text-sky-ink">
        <div aria-hidden className="soft-edges pointer-events-none absolute inset-0">
          <Starfield count={70} seed={23} />
          <div className="absolute inset-0 bg-[radial-gradient(45%_55%_at_50%_55%,rgb(70_95_160/0.16),transparent_75%)]" />
        </div>
        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-8">
          <Mascot wave className="w-28" />
          <h2 className="mt-6 font-serif text-4xl font-light tracking-tight sm:text-5xl">Start today. Twenty minutes counts.</h2>
          <p className="mt-3 text-sky-muted">Free during early access. No card needed.</p>
          <div className="mt-8">
            <AppCta label="Create your free account" />
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * One step of the roadmap, as a card in the deck: it pins a little lower than the one before, so the stack shows its
 * edges, and sinks back (--depth, set by Roadmap) as later cards come over it.
 */
function Chapter({
  id,
  index,
  title,
  body,
  aside,
  children,
}: {
  id: string;
  index: number;
  title: string;
  body: React.ReactNode;
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article id={id} data-card className="roadmap-card" style={{ zIndex: index }}>
      <div className="roadmap-card-face grid gap-8 overflow-hidden p-5 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10 lg:p-10">
        <div className="min-w-0">
          <p className="text-sm tabular-nums text-[var(--ochre)]">
            Step {index + 1} of {CHAPTERS.length}
          </p>
          {/* Phones get tighter type, so a whole step fits the deck without clipping. */}
          <h2 className="mt-2 text-balance font-serif text-[1.6rem] font-light leading-[1.15] tracking-tight sm:mt-2.5 sm:text-[2.1rem] sm:leading-[1.12]">
            {title}
          </h2>
          <p className="mt-3 font-serif text-[0.95rem] leading-[1.55] text-sky-ink/90 sm:mt-4 sm:text-[1.05rem] sm:leading-relaxed">{body}</p>
          <p className="roadmap-aside mt-2.5 text-[0.85rem] leading-relaxed text-sky-muted sm:mt-3 sm:text-[0.9rem]">{aside}</p>
          {/* The mascot says this above the deck; here for screen readers. */}
          <p className="sr-only">Tip: {tipFor(id)}</p>
        </div>
        {/* The illustration, beside the words on wide screens. Phones keep to the words, so the card fits the deck. */}
        <div className="hidden min-w-0 lg:block">{children}</div>
        {/* Darkens the card as later ones land on it (Roadmap sets its opacity). */}
        <div data-shade aria-hidden className="roadmap-card-shade" />
      </div>
    </article>
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
