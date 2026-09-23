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

Progress is saved in the browser and, when accounts are configured, synced to Postgres (Neon) so it follows her across devices. Without a database the app runs browser-only, and Settings has export and import for backups.

## Run it locally

```sh
cp .env.example .env.local   # add OPENAI_API_KEY (or ANTHROPIC_API_KEY)
npm install
npm run dev                  # http://localhost:3000
```

That runs in browser-only mode: no login, progress in localStorage. To try accounts and sync locally, start the bundled Postgres (Docker) and point the app at it:

```sh
npm run db:up                # Postgres + Neon's HTTP proxy on port 4445
# in .env.local:
#   DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/southward
#   AUTH_SECRET=$(openssl rand -base64 32)
npm run db:migrate
npm run dev
```

With only `OPENAI_API_KEY` set, the AI uses OpenAI (`gpt-5.5` by default); with only `ANTHROPIC_API_KEY`, Claude (`claude-opus-5`). If both are set it uses Claude unless `AI_PROVIDER=openai`.

## Deploy to Vercel

```sh
vercel link                                   # create or link the Vercel project
vercel integration add neon                   # provisions Postgres and sets DATABASE_URL
vercel env add OPENAI_API_KEY                 # your OpenAI key
vercel env add AUTH_SECRET                    # paste the output of: openssl rand -base64 32
vercel deploy --prod
```

The build runs `scripts/migrate.mjs` first, which creates the tables if they don't exist, so there's no separate database step. Then open the site and choose "Create account". Progress she made before having an account is uploaded to it on first sign-in.

How it protects your API key and her data:

- The AI routes only answer signed-in users, and each user is capped at `AI_DAILY_LIMIT` requests a day (default 300).
- A deployment without `DATABASE_URL` and `AUTH_SECRET` refuses AI requests entirely rather than running open.
- Passwords are hashed with scrypt; sessions are signed, HttpOnly cookies that last 60 days.
- Two devices can't overwrite each other: every save carries a version number, and a stale save is merged instead of applied.

## Stack

Next.js 16 (App Router), React 19, Tailwind CSS 4, Zustand, the OpenAI and Anthropic TypeScript SDKs behind one small layer in `src/lib/server/ai.ts`, and Neon Postgres (`@neondatabase/serverless`) for accounts and sync (`src/lib/server/db.ts`, `auth.ts`, `src/app/api/progress`). AI routes live in `src/app/api/*`. They stream text for the tutor, lessons, explanations and patient, and use structured outputs (Zod) for question generation and OSCE marking. On Claude, server-side refusal fallbacks are enabled.

## Content

Static content lives in `src/content/` and follows the types in `src/lib/types.ts`. Topic ids are listed in `src/content/TOPICS.md`. Guidelines change, so check anything time-sensitive (immunisation schedule, screening intervals, PBS listings) against eTG, the Australian Immunisation Handbook and amc.org.au.
