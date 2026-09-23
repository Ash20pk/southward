# Southward

A study companion for Indian MBBS students heading to the Australian Medical Council (AMC) exams. It starts from zero: what the Standard Pathway is, a study plan sized to the time until your MCQ date, and daily practice across all six AMC disciplines, with an AI (OpenAI or Claude, your choice) as tutor, question writer, practice patient and examiner.

Not affiliated with the AMC. Written for exam practice, not patient care.

## What's inside

- **Today**: countdown, streak, a daily session (flashcards, questions, a clinical station), weak topics, and the Southern Cross: five stars that brighten as you work through foundations, the question bank, MCQ readiness, clinical skills and Australian context.
- **Your pathway**: the AMC Standard Pathway explained, a four-phase plan from today to your target date, and a milestones checklist (WDOMS, EPIC verification, English test, MCQ, clinical exam, AMC Certificate).
- **Learn**: 52 syllabus topics with must-know points and India vs Australia differences, plus an on-demand AI lesson per topic (saved once written).
- **Practice**: 190 hand-written AMC-style MCQs with explanations, a note on each distractor, and Australian pearls. Filters for mistakes, saved and unseen questions. "Why was my answer wrong?" opens an AI explanation you can ask follow-ups on. An AI generator writes fresh questions on any topic and difficulty.
- **Mock exams**: mini (30), half (75) and full (150) timed papers at real exam pace, with a question navigator, flags and a report by discipline.
- **Flashcards**: 200 atomic cards with SM-2 spaced repetition.
- **Clinical stations**: 18 OSCE stations. Two minutes of reading, eight minutes with an AI role-play patient (type or speak, and the patient can reply aloud), then an AI examiner's global rating, domain scores, criteria met or missed, and a model answer.
- **Ask the tutor**: open chat tuned to Australian guidelines.
- **Australia 101**: 30 short reads on Medicare, the PBS, consent and the law, screening, immunisation, cultural safety and more.

Progress is stored in the browser (localStorage). Settings has export and import for backups or moving devices.

## Run it

```sh
cp .env.example .env.local   # add OPENAI_API_KEY or ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Everything except the AI features works without a key. With only `OPENAI_API_KEY` set, the app uses OpenAI (`gpt-5.5` by default); with only `ANTHROPIC_API_KEY`, Claude (`claude-opus-5`). If both are set it uses Claude unless `AI_PROVIDER=openai`. Models can be overridden with `OPENAI_MODEL` / `ANTHROPIC_MODEL`.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, Zustand, and the OpenAI and Anthropic TypeScript SDKs behind one small layer in `src/lib/server/ai.ts`. AI routes live in `src/app/api/*`. They stream text for the tutor, lessons, explanations and patient, and use structured outputs (Zod) for question generation and OSCE marking. On Claude, server-side refusal fallbacks are enabled.

## Content

Static content lives in `src/content/` and follows the types in `src/lib/types.ts`. Topic ids are listed in `src/content/TOPICS.md`. Guidelines change, so check anything time-sensitive (immunisation schedule, screening intervals, PBS listings) against eTG, the Australian Immunisation Handbook and amc.org.au.
