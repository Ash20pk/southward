"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ArrowLeft, Check, Copy, ExternalLink, Search } from "lucide-react";
import { Mascot, type MascotMood } from "@/components/Mascot";
import { SIGNUP_PATH } from "@/lib/site";

/*
 * "Can you sit the AMC exams?": the home page's closing hook. Three short steps, then a verdict:
 *   1. Your college, picked from the NMC's list of colleges teaching MBBS (scripts/build-colleges.mjs).
 *   2. Where you are in MBBS, and the year your degree was or will be awarded.
 *   3. The AMC's actual test: the college's World Directory of Medical Schools entry carries an ECFMG sponsor note whose
 *      graduation years include yours. WDOMS doesn't allow its data to be copied, so the candidate looks it up there
 *      (we say exactly what to look for) and tells us what they found.
 * Eligible, or on track to be, leads to sign-up; the answers are kept in this browser so onboarding starts from them.
 */

interface College {
  id: number;
  name: string;
  state: string;
  university: string;
  /** Read from the end of the NMC's name where it gives one; a suggestion for the WDOMS search. */
  city?: string;
  m?: "G" | "P" | "T" | "S";
  since?: number;
}

/** The same stages as onboarding, so the answer carries straight over. */
const STAGES = [
  { id: "4th-year", label: "4th year MBBS", hint: "Final professional part 1" },
  { id: "final-year", label: "Final year MBBS", hint: "Final professional part 2" },
  { id: "internship", label: "Internship", hint: "Compulsory rotating internship" },
  { id: "graduated", label: "Degree awarded", hint: "MBBS in hand" },
] as const;
type Stage = (typeof STAGES)[number]["id"];

type Found = "yes" | "no" | "unsure";
type Step = "college" | "stage" | "wdoms" | "result";
const STEPS: Step[] = ["college", "stage", "wdoms", "result"];

const WDOMS = "https://search.wdoms.org/";
const AMC_CHECK = "https://www.amc.org.au/check-eligible-medical-school-medical-degrees-and-graduation-years/";
export const ELIGIBILITY_KEY = "southward-eligibility";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const SMALL = new Set(["of", "and", "the", "for", "in"]);
/** The initials people know a college by: "All India Institute of Medical Sciences" is "aiims". */
const initials = (name: string) =>
  fold(name.split(",")[0])
    .split(" ")
    .filter((w) => w && !SMALL.has(w))
    .map((w) => w[0])
    .join("");

/**
 * Every word typed has to start a word of the college's name, state or university, or (three letters or more) its
 * initials, as in AIIMS or MAMC. Name matches rank first.
 */
function search(colleges: College[], query: string) {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const scored: [number, College][] = [];
  for (const c of colleges) {
    const name = ` ${fold(c.name)}`;
    const rest = ` ${fold(`${c.state} ${c.university}`)}`;
    const short = initials(c.name);
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (name.includes(` ${w}`)) score += 2;
      else if (w.length >= 3 && short.startsWith(w)) score += 2;
      else if (rest.includes(` ${w}`)) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (ok) scored.push([score + (name.startsWith(` ${words[0]}`) ? 1 : 0), c]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).slice(0, 7).map(([, c]) => c);
}

export function Eligibility() {
  const [step, setStep] = useState<Step>("college");
  const [colleges, setColleges] = useState<College[] | null>(null);
  const [college, setCollege] = useState<College | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const card = useRef<HTMLDivElement>(null);

  // The list only loads when someone starts the check, so it costs the page nothing until then.
  const load = () => {
    if (!colleges) import("@/content/colleges.json").then((m) => setColleges(m.default as College[]));
  };

  const go = (next: Step) => {
    setStep(next);
    // Each step's heading takes focus, so a screen reader hears where it is and keyboards carry on from there.
    // And if the step above was taller and the new one starts off the top of the screen, the card comes back into view.
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      const top = card.current?.getBoundingClientRect().top ?? 0;
      if (top < 64) {
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        card.current?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
      }
    });
  };

  const verdict = found === "yes" ? (stage === "graduated" ? "eligible" : "on-track") : found === "no" ? "not-yet" : "unsure";

  useEffect(() => {
    if (step !== "result" || !stage) return;
    try {
      localStorage.setItem(ELIGIBILITY_KEY, JSON.stringify({ stage, year, college: college?.name, verdict, at: Date.now() }));
    } catch {}
  }, [step, stage, year, college, verdict]);

  const restart = () => {
    setCollege(null);
    setStage(null);
    setYear(null);
    setFound(null);
    go("college");
  };

  const at = STEPS.indexOf(step);
  const mood: MascotMood = step === "result" && verdict !== "on-track" && verdict !== "not-yet" ? (verdict === "eligible" ? "wink" : "wow") : "happy";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-end justify-center gap-3 sm:gap-5">
        <div className="w-16 shrink-0 sm:w-20">
          <Mascot mood={mood} wave={step === "college" || verdict === "eligible"} className="w-full" />
        </div>
        <p key={`${step}-${verdict}`} aria-hidden className="bubble tip-pop mb-3 max-w-xs px-3.5 py-2.5 text-left text-[0.9rem] leading-snug text-sky-ink">
          {SAYS[step === "result" ? verdict : step]}
          <span className="bubble-tail left -left-[0.5rem] bottom-4" />
        </p>
      </div>

      <div ref={card} className="glass mt-5 scroll-mt-20 rounded-3xl p-5 text-left sm:p-7">
        {/* Progress: three questions, then the answer. */}
        <div className="flex items-center justify-between gap-4">
          <ol aria-label="Progress" className="flex items-center gap-1.5">
            {STEPS.slice(0, 3).map((s, i) => (
              <li
                key={s}
                aria-current={i === at ? "step" : undefined}
                className={clsx(
                  "h-1.5 rounded-full transition-[width,background-color] duration-300",
                  i === at ? "w-7 bg-[var(--ochre)]" : i < at ? "w-3 bg-[var(--ochre)]/50" : "w-3 bg-white/15",
                )}
              />
            ))}
          </ol>
          {at > 0 && (
            <button
              type="button"
              onClick={() => (step === "result" ? restart() : go(STEPS[at - 1]))}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-sky-muted hover:text-sky-ink"
            >
              {step === "result" ? "Start over" : (<><ArrowLeft size={15} aria-hidden /> Back</>)}
            </button>
          )}
        </div>

        <div key={step} className="rise mt-5">
          {step === "college" && (
            <>
              <StepHeading ref={heading} kicker="1 of 3" title="Where did you study medicine?" />
              <CollegeSearch
                colleges={colleges}
                onFocus={load}
                onPick={(c) => {
                  setCollege(c);
                  go("stage");
                }}
              />
              <p className="mt-3 text-sm text-sky-muted">
                From the National Medical Commission&rsquo;s list of {colleges ? colleges.length : "800+"} colleges teaching MBBS.
              </p>
            </>
          )}

          {step === "stage" && (
            <>
              <StepHeading ref={heading} kicker="2 of 3" title="Where are you in MBBS?" />
              {college && <CollegeChip college={college} />}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={stage === s.id}
                    onClick={() => {
                      setStage(s.id);
                      setYear(null);
                    }}
                    className={clsx(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      stage === s.id ? "border-[var(--ochre)] bg-[var(--ochre)]/10" : "border-white/10 hover:border-white/25",
                    )}
                  >
                    <span className="block font-medium">{s.label}</span>
                    <span className="block text-sm text-sky-muted">{s.hint}</span>
                  </button>
                ))}
              </div>
              {stage && <YearPicker stage={stage} college={college} year={year} onYear={setYear} />}
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={!stage || !year}
                  onClick={() => go("wdoms")}
                  className="h-11 rounded-full bg-ochre px-5 font-medium text-sky transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          )}

          {step === "wdoms" && college && year && (
            <>
              <StepHeading ref={heading} kicker="3 of 3" title="Check your college on the World Directory" />
              <p className="mt-2 text-sky-muted">
                The AMC accepts a degree when the college&rsquo;s entry in the World Directory of Medical Schools has an{" "}
                <strong className="font-medium text-sky-ink">ECFMG sponsor note</strong> covering your graduation year. It takes a
                minute to look up.
              </p>
              <WdomsSteps college={college} year={year} />
              <p className="mt-5 font-medium">What did you find?</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["yes", "It's there", `ECFMG note, and ${year} is covered`],
                    ["no", "It isn't", "No ECFMG note, or not my year"],
                    ["unsure", "Can't tell", "Couldn't find it or not sure"],
                  ] as const
                ).map(([id, label, hint]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setFound(id);
                      go("result");
                    }}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-left transition-colors hover:border-[var(--ochre)] hover:bg-[var(--ochre)]/10"
                  >
                    <span className="block font-medium">{label}</span>
                    <span className="block text-sm text-sky-muted">{hint}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "result" && <Result ref={heading} verdict={verdict} college={college} stage={stage} year={year} />}
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-sky-muted/80">
        A guide, not an official assessment. The AMC confirms eligibility when it verifies your degree.
      </p>
    </div>
  );
}

const SAYS: Record<Step | "eligible" | "on-track" | "unsure" | "not-yet", string> = {
  college: "Let's see if the AMC pathway is open to you. It takes about a minute.",
  stage: "Nice. Now, how far along are you?",
  wdoms: "This is the check the AMC itself uses. I'll show you where to look.",
  result: "",
  eligible: "You're good to go! Let's get you ready for Part 1.",
  "on-track": "You're on track. The earlier you start, the easier it gets.",
  unsure: "No worries, plenty of people need a second look. Here's how to be sure.",
  "not-yet": "Not this time, but rules and notes do change. Here's what to check.",
};

function StepHeading({ ref, kicker, title }: { ref: React.Ref<HTMLHeadingElement>; kicker: string; title: string }) {
  return (
    <>
      <p className="text-sm tabular-nums text-[var(--ochre)]">{kicker}</p>
      <h3 ref={ref} tabIndex={-1} className="mt-1 font-serif text-2xl font-light leading-tight outline-none sm:text-[1.7rem]">
        {title}
      </h3>
    </>
  );
}

function CollegeChip({ college }: { college: College }) {
  return (
    <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 text-sm text-sky-muted">
      <Check size={14} className="shrink-0 text-[var(--ochre)]" aria-hidden />
      <span className="truncate">{college.name}</span>
    </p>
  );
}

/** A searchable list of colleges (an ARIA combobox): type, then arrows and Enter, or tap. */
function CollegeSearch({ colleges, onFocus, onPick }: { colleges: College[] | null; onFocus: () => void; onPick: (c: College) => void }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => (colleges ? search(colleges, query) : []), [colleges, query]);
  const open = query.trim().length > 1;

  return (
    <div className="relative mt-4">
      <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-3.5 text-sky-muted" />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && results[active] ? `${id}-${results[active].id}` : undefined}
        aria-autocomplete="list"
        aria-label="Your medical college"
        autoComplete="off"
        placeholder="Start typing your college or city"
        value={query}
        onFocus={onFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && results[active]) onPick(results[active]);
          else return;
          e.preventDefault();
        }}
        className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-base text-sky-ink placeholder:text-sky-muted/70 focus:border-[var(--ochre)] focus:outline-none"
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1729] p-1.5">
          {!colleges && <li className="px-3 py-2.5 text-sm text-sky-muted">Loading colleges&hellip;</li>}
          {colleges && !results.length && (
            <li className="px-3 py-2.5 text-sm text-sky-muted">
              No college matches that. Try the city, or a shorter part of the name.
            </li>
          )}
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`${id}-${c.id}`}
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onClick={() => onPick(c)}
              className={clsx("cursor-pointer rounded-xl px-3 py-2.5", i === active && "bg-white/[0.07]")}
            >
              <span className="block text-[0.95rem] leading-snug">{c.name}</span>
              <span className="block text-sm text-sky-muted">
                {c.state}
                {c.since ? `, since ${c.since}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The year the degree was awarded, or is expected: a past year once graduated, a coming one before. */
function YearPicker({ stage, college, year, onYear }: { stage: Stage; college: College | null; year: number | null; onYear: (y: number) => void }) {
  const now = new Date().getFullYear();
  const years =
    stage === "graduated"
      ? Array.from({ length: 30 }, (_, i) => now - i)
      : Array.from({ length: { "4th-year": 4, "final-year": 3, internship: 2 }[stage] }, (_, i) => now + i);
  // An MBBS takes five and a half years: a first batch graduates about six years after the college opened.
  const tooEarly = college?.since && year && year < college.since + 6;
  return (
    <label className="mt-4 block">
      <span className="font-medium">{stage === "graduated" ? "Year your degree was awarded" : "Year you expect your degree"}</span>
      <select
        value={year ?? ""}
        onChange={(e) => onYear(Number(e.target.value))}
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-base text-sky-ink focus:border-[var(--ochre)] focus:outline-none"
      >
        <option value="" disabled>
          Choose a year
        </option>
        {years.map((y) => (
          <option key={y} value={y} className="bg-[#0f1729]">
            {y}
          </option>
        ))}
      </select>
      {tooEarly && (
        <span className="mt-2 block text-sm text-[var(--ochre)]">
          {college!.name.split(",")[0]} opened in {college!.since}, so its first graduates were due around {college!.since! + 6}. Double-check the
          year.
        </span>
      )}
    </label>
  );
}

/** Exactly what to do on WDOMS, with the college's name ready to paste. */
function WdomsSteps({ college, year }: { college: College; year: number }) {
  const short = college.name.split(",")[0];
  return (
    <ol className="mt-4 flex flex-col gap-3 text-[0.95rem]">
      <li className="flex gap-3">
        <Num n={1} />
        <div className="min-w-0 flex-1">
          {/* Search by city: WDOMS often spells a college's name differently from the NMC (T S Misra here, T.S. Mishra
              there), so a name search can come back empty for a college that is listed. */}
          Open the World Directory and search <span className="text-sky-ink">Country: India</span> and{" "}
          <span className="text-sky-ink">City: {college.city ?? "your college's city"}</span>, then find your college in
          the list.
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={WDOMS}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-sm text-sky-ink hover:bg-white/[0.14]"
            >
              Open WDOMS <ExternalLink size={14} aria-hidden />
            </a>
            {college.city && <CopyChip label="City" text={college.city} />}
          </div>
          <p className="mt-2 text-sm text-sky-muted">
            Names are often spelled differently there, so the city is the surer search. If it isn&rsquo;t listed under that
            city, try a nearby one, or part of the name:
          </p>
          <div className="mt-2">
            <CopyChip label="Name" text={short} />
          </div>
        </div>
      </li>
      <li className="flex gap-3">
        <Num n={2} />
        <span>
          Open your college and go to the <span className="text-sky-ink">Sponsor Notes</span> tab. Look for a note from{" "}
          <span className="text-sky-ink">ECFMG</span>.
        </span>
      </li>
      <li className="flex gap-3">
        <Num n={3} />
        <span>
          Check its graduation years include <span className="text-sky-ink tabular-nums">{year}</span>.
        </span>
      </li>
    </ol>
  );
}

/** A value to paste into WDOMS, copied on a tap. */
function CopyChip({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()}: ${text}`}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm hover:border-white/25"
    >
      {copied ? <Check size={14} className="shrink-0 text-[var(--ochre)]" aria-hidden /> : <Copy size={14} className="shrink-0" aria-hidden />}
      <span className="shrink-0 text-sky-muted">{label}</span>
      <span className="truncate">{copied ? "Copied" : text}</span>
    </button>
  );
}

const Num = ({ n }: { n: number }) => (
  <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--ochre)]/15 text-xs font-semibold tabular-nums text-[var(--ochre)]">
    {n}
  </span>
);

function Result({
  ref,
  verdict,
  college,
  stage,
  year,
}: {
  ref: React.Ref<HTMLHeadingElement>;
  verdict: "eligible" | "on-track" | "unsure" | "not-yet";
  college: College | null;
  stage: Stage | null;
  year: number | null;
}) {
  const name = college?.name.split(",")[0] ?? "your college";
  const copy = {
    eligible: {
      kicker: "You look eligible",
      title: "The Standard Pathway is open to you",
      body: `${name} is covered for ${year}, and your degree is awarded. Next: open your AMC candidate account and start verifying your degree through EPIC, which can take weeks, while you prepare for Part 1.`,
      cta: "Start preparing for Part 1",
    },
    "on-track": {
      kicker: "You're on track",
      title: `You can apply once your degree is awarded${year ? ` in ${year}` : ""}`,
      body: `${name} is covered, so you'll be eligible as soon as your MBBS is awarded (after internship, in India). ${
        stage === "internship" ? "Internship is" : "These last years of MBBS are"
      } the best time to start: twenty minutes a day now saves months later.`,
      cta: "Get a head start, free",
    },
    unsure: {
      kicker: "Not sure yet",
      title: "One more look will settle it",
      body: "WDOMS often spells names differently, so search by city (or a nearby one) and look through the list, then check the Sponsor Notes tab for ECFMG. The AMC's own page walks through the same check, and you can ask the AMC directly. You can start preparing in the meantime.",
      cta: "Start preparing anyway",
    },
    "not-yet": {
      kicker: "Not on this degree, for now",
      title: "The AMC needs that ECFMG note",
      body: `Without an ECFMG sponsor note covering ${year ?? "your graduation year"}, the AMC can't accept the degree for the Standard Pathway. Notes are updated, so check with the AMC before deciding anything.`,
      cta: null,
    },
  }[verdict];

  return (
    <>
      <p className={clsx("text-sm", verdict === "not-yet" ? "text-sky-muted" : "text-[var(--ochre)]")}>{copy.kicker}</p>
      <h3 ref={ref} tabIndex={-1} className="mt-1 font-serif text-2xl font-light leading-tight outline-none sm:text-3xl">
        {copy.title}
      </h3>
      <p className="mt-3 leading-relaxed text-sky-muted">{copy.body}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {copy.cta && (
          <Link
            href={SIGNUP_PATH}
            className="inline-flex h-11 items-center justify-center rounded-full bg-ochre px-5 font-medium text-sky transition hover:brightness-110"
          >
            {copy.cta}
          </Link>
        )}
        <a
          href={AMC_CHECK}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-sky-muted hover:text-sky-ink"
        >
          The AMC&rsquo;s eligibility check <ExternalLink size={14} aria-hidden />
        </a>
      </div>
      {copy.cta && <p className="mt-3 text-sm text-sky-muted">Free during early access. No card needed.</p>}
    </>
  );
}
