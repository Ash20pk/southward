"use client";

import Link from "next/link";
import { ArrowLeftRight, Flame, Layers, Stethoscope, Target, Timer } from "lucide-react";
import { streak, useStore } from "@/lib/store";
import { SouthernCross } from "@/components/SouthernCross";
import { Bar, ButtonLink, DisciplineDot, Panel } from "@/components/ui";
import {
  answeredToday,
  byDiscipline,
  constellation,
  daysUntil,
  dueCards,
  lastNDays,
  NEW_CARDS_PER_DAY,
  readiness,
  weakestTopics,
} from "@/lib/stats";
import { STATIONS, subjectById } from "@/lib/content";
import { currentPhase } from "@/lib/plan";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Today() {
  const s = useStore();
  const profile = s.profile!;
  const stars = constellation(s);
  const done = answeredToday(s.log);
  const goal = profile.dailyQuestions;
  const { due, unseen } = dueCards(s.srs);
  const cardsToday = due.length + Math.min(unseen.length, NEW_CARDS_PER_DAY);
  const weak = weakestTopics(s.log);
  const days = daysUntil(profile.mcqTarget);
  const phase = currentPhase(profile);
  const ready = readiness(s.log, s.mocks);
  const history = lastNDays(s.log);
  const maxDay = Math.max(goal, ...history.map((h) => h.count));
  const disc = byDiscipline(s.log);
  const nextStation = STATIONS.find((st) => !s.osce.some((o) => o.stationId === st.id)) ?? STATIONS[0];
  const st = streak(s.studyDays);
  const posting = subjectById(profile.posting);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero: the night sky with her constellation */}
      <section className="rise relative overflow-hidden rounded-3xl bg-sky text-sky-ink">
        <div className="grid gap-4 p-6 sm:p-10 md:grid-cols-[1.25fr_1fr] md:items-center">
          <div>
            <p className="text-sky-muted">{greeting()}, {profile.name}.</p>
            <h1 className="mt-2 text-3xl font-semibold leading-[1.12] tracking-tight sm:text-[2.6rem]">
              {days > 0 ? (
                <>
                  {days} days to your MCQ target.
                  <span className="block text-sky-muted">You&rsquo;re in {phase.name.toLowerCase()}.</span>
                </>
              ) : (
                <>Your MCQ target date has arrived. Update it in Settings when you book.</>
              )}
            </h1>
            <p className="mt-4 max-w-md font-serif text-[1.05rem] leading-relaxed text-sky-muted">{phase.focus}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-sky-muted">
              <span className="inline-flex items-center gap-1.5">
                <Flame size={16} className="text-[var(--ochre)]" /> {st} day{st === 1 ? "" : "s"} in a row
              </span>
              <span>{ready === null ? "Readiness unlocks after 20 answers" : `Readiness ${ready}%`}</span>
              <Link href="/pathway" className="underline decoration-sky-muted/50 underline-offset-4 hover:text-white">
                See the full pathway
              </Link>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[190px] md:max-w-[300px]">
            <SouthernCross stars={stars} />
          </div>
        </div>
        <ol className="grid grid-cols-1 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-5">
          {stars.map((star) => (
            <li key={star.key} className="bg-sky px-5 py-3 sm:py-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{star.label}</span>
                <span className="tabular-nums text-[var(--ochre)]">{Math.round(star.value)}%</span>
              </div>
              <div className="mt-1 text-xs leading-snug text-sky-muted">{star.detail}</div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <h2 className="text-xl font-semibold">Today&rsquo;s session</h2>
          <p className="mt-1 text-muted">About {Math.round(goal * 1.5 + cardsToday * 0.3)} minutes, in this order.</p>
          <ol className="mt-5 flex flex-col divide-y divide-line">
            <TodayItem
              n={1}
              icon={<Layers size={18} />}
              title="Flashcards"
              detail={cardsToday ? `${due.length} due for review, ${Math.min(unseen.length, NEW_CARDS_PER_DAY)} new` : "All caught up"}
              progress={cardsToday ? 0 : 100}
              href="/flashcards"
              cta={cardsToday ? "Review" : "Browse"}
            />
            <TodayItem
              n={2}
              icon={<Target size={18} />}
              title={
                weak[0]
                  ? `Questions, starting with ${weak[0].topic.name}`
                  : posting
                    ? `Questions matching your ${posting.name} posting`
                    : "Practice questions"
              }
              detail={`${Math.min(done, goal)} of ${goal} answered today`}
              progress={(done / goal) * 100}
              href={weak[0] ? `/practice?topic=${weak[0].topic.id}` : posting ? `/practice?subject=${posting.id}` : "/practice"}
              cta={done >= goal ? "Do more" : "Start"}
            />
            <TodayItem
              n={3}
              icon={<Stethoscope size={18} />}
              title={`Clinical station: ${nextStation.title}`}
              detail="One station a week keeps the talking skills warm"
              href={`/clinical/${nextStation.id}`}
              cta="Open"
            />
            {posting && (
              <TodayItem
                n={4}
                icon={<ArrowLeftRight size={18} />}
                title={`Your posting: ${posting.name}`}
                detail="What carries over to the AMC, and where Australia differs"
                href={`/mbbs?s=${posting.id}`}
                cta="See map"
              />
            )}
          </ol>
        </Panel>

        <Panel>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Last two weeks</h2>
            <span className="text-sm text-muted">questions per day</span>
          </div>
          <div className="mt-6 flex h-36 items-end gap-1.5" role="img" aria-label="Questions answered per day over the last 14 days">
            {history.map((h) => (
              <div key={h.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <div className="relative w-full flex-1">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-md bg-brand/25"
                    style={{ height: `${(h.count / maxDay) * 100}%` }}
                    title={`${h.day}: ${h.count} answered, ${h.correct} correct`}
                  >
                    <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-brand" style={{ height: h.count ? `${(h.correct / h.count) * 100}%` : 0 }} />
                  </div>
                  <div className="absolute inset-x-0 border-t border-dashed border-ochre/70" style={{ bottom: `${(goal / maxDay) * 100}%` }} />
                </div>
                <span className="text-[11px] text-muted">{h.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">
            Solid bar is correct answers. The dashed line is your daily goal of {goal}.
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-xl font-semibold">How you&rsquo;re doing by discipline</h2>
          <p className="mt-1 text-muted">Accuracy on your last 100 answers in each. Aim for 65% or more.</p>
          <ul className="mt-5 flex flex-col gap-4">
            {disc.map((d) => (
              <li key={d.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[0.95rem]">
                  <span className="flex items-center gap-2">
                    <DisciplineDot color={d.color} /> {d.name}
                  </span>
                  <span className="tabular-nums text-muted">
                    {d.accuracy === null ? "not started" : `${Math.round(d.accuracy)}% of ${d.answered}`}
                  </span>
                </div>
                <Bar value={d.accuracy ?? 0} color={d.color} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold">Where to focus</h2>
          {weak.length ? (
            <>
              <p className="mt-1 text-muted">Your three weakest topics so far. A short lesson, then 10 questions, fixes most gaps.</p>
              <ul className="mt-5 flex flex-col gap-3">
                {weak.map((w) => (
                  <li key={w.topic.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sunk px-4 py-3">
                    <div>
                      <div className="font-medium">{w.topic.name}</div>
                      <div className="text-sm text-muted">
                        {Math.round(w.accuracy ?? 0)}% over {w.answered} answers
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <ButtonLink href={`/learn/${w.topic.id}`} variant="outline" size="sm">
                        Lesson
                      </ButtonLink>
                      <ButtonLink href={`/practice?topic=${w.topic.id}`} size="sm">
                        Practise
                      </ButtonLink>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="mt-3 text-muted">
              <p>Once you&rsquo;ve answered a few questions per topic, your weak spots show up here.</p>
              <p className="mt-3">
                New to all this? Start with <Link href="/pathway" className="text-brand underline">your pathway</Link> to
                see how the AMC works, then read{" "}
                <Link href="/australia" className="text-brand underline">Australia 101</Link>.
              </p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Timer size={18} className="text-ochre-ink" />
            <span className="flex-1 text-[0.95rem]">
              {s.mocks.length
                ? `Last mock: ${Math.round((s.mocks.at(-1)!.correct / s.mocks.at(-1)!.total) * 100)}%`
                : "You haven't taken a mock exam yet."}
            </span>
            <ButtonLink href="/mock" variant="outline" size="sm">
              Mock exams
            </ButtonLink>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function TodayItem(props: {
  n: number;
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
  cta: string;
  progress?: number;
}) {
  return (
    <li className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
        {props.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          <span className="sr-only">Step {props.n}: </span>
          {props.title}
        </div>
        <div className="text-sm text-muted">{props.detail}</div>
        {props.progress !== undefined && <Bar value={props.progress} className="mt-2 max-w-56" />}
      </div>
      <ButtonLink href={props.href} size="sm" variant="outline">
        {props.cta}
      </ButtonLink>
    </li>
  );
}
