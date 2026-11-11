# University OS

A multi-user, privacy-first "operating system" for university students: courses, syllabi, materials, deadlines,
grades/GPA planning and (optionally) AI help — one connected workspace per student, with light and dark themes.

> **Status: first milestone (foundation + academic core + syllabus-first slice).** See
> [docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md) for exactly what is implemented, tested, partial, planned or blocked.
> Nothing in the UI is simulated: unavailable features say so.

## What works today (all covered by automated tests — see the report in docs/PROGRESS.md)

- Accounts: register, sign in/out, change password, password reset (dev-link only — no email provider), account deletion, data export
- Independent per-user workspaces enforced by **PostgreSQL Row Level Security** (tested, including direct API attacks)
- Onboarding: university, programme, grading scale (editable, nothing hardcoded), academic year and periods
- Light / Dark / System themes, persisted per account, no flash on load
- Courses (active / completed / archived), topics, assessments with weights, grades, class timetable, tasks (subtasks, recurrence, reminders, board), calendar, notes, notifications
- **Syllabus-first workflow:** upload PDF/DOCX/TXT/MD → text extraction → *draft* → you review/edit → approve → course + topics + weighted assessments are created
- Course materials: upload, text extraction, full-text search with **document + page citations** (no AI needed)
- Grade engine: weighted grades, GPA (credit-weighted, never confused with percent), required score on the remaining work, what-if, best/worst case, formulas shown, "mathematically unreachable" explained
- User-defined requirements (pass mark, minimum final, retake threshold, scholarship GPA) — never assumed, only checked
- Dashboard with customizable widgets, command palette (⌘K), quick capture (C), keyboard shortcuts
- Optional AI layer (Gemini adapter) for syllabus analysis only; explicit consent, daily limit, usage ledger — **unverified against the live API (no key/network)**

## What is NOT built yet (honest list)

AI tutor, flashcards/spaced repetition, quizzes, study planner, grade-screenshot analysis, attendance tracker, risk overview,
universal inbox, student administration/secretary, collaboration, voice notes, Chinese studio, coding lab, career centre,
gamification, PWA/offline, email integration, LMS/EDUS sync. See the gap analysis and roadmap.

## Quick start (local, no cloud account needed)

Requirements: Node 20+, PostgreSQL 15+ (16 tested) with `initdb`/`pg_ctl`, or Docker.

```bash
npm install

# 1. start a throw-away local Postgres on port 54329 (skip if you already have one)
mkdir -p ~/pgdev && initdb -D ~/pgdev/data -A trust -U postgres && pg_ctl -D ~/pgdev/data -o "-p 54329" -l ~/pgdev/log start
createdb -h localhost -p 54329 -U postgres university_os

# 2. configure
cp .env.example .env.local

# 3. create the schema (applies the LOCAL-ONLY Supabase shim + migrations)
npm run db:reset

# 4. run
npm run dev          # http://localhost:3000
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | unit tests + real-Postgres DB tests (needs `university_os_test` DB, see tests/db/urls.ts) |
| `npm run test:e2e` | production build + Playwright (needs `university_os_e2e` DB; uses `/opt/pw-browsers/chromium` or `PW_CHROMIUM_PATH`) |
| `npm run db:migrate` / `db:reset` | apply migrations / **drop everything** and rebuild (local shim only) |

Create the test databases once: `createdb university_os_test; createdb university_os_e2e` (same host/port as above).

## Environment variables

See [.env.example](.env.example). Required: `DATABASE_URL`, `DATABASE_ADMIN_URL` (local auth + migrations). Optional: `GEMINI_API_KEY`
and friends. No secret ever reaches the browser; `.env.local` is git-ignored.

## Supabase

The schema in `supabase/migrations/*.sql` is plain Postgres written for Supabase conventions (`auth.users`, `auth.uid()`,
`authenticated` role, RLS). **Supabase has not been exercised in this milestone** (no project/credentials in the build environment).
To try it: create a project, run the migrations with `supabase db push` (do **not** apply `db/local`), and note that the app's
auth is currently the built-in *local* provider, which needs `auth.users` + `local_auth` tables the shim creates — a Supabase Auth
provider is the first item of the next milestone (see docs/ARCHITECTURE.md → "Auth"). Until then, run against any Postgres with the shim
(local, Docker, Neon, a Supabase project's database *with the shim's `local_auth` schema applied by hand* — advanced, untested).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, ownership model, auth, AI, ERD
- [docs/GAP_ANALYSIS.md](docs/GAP_ANALYSIS.md) — spec vs reality, roadmap and priorities
- [docs/COSTS.md](docs/COSTS.md) — free tiers, limits, what happens at quota
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) — AITU LMS / EDUS findings
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — security, privacy, backup & recovery
- [docs/PROGRESS.md](docs/PROGRESS.md) — engineering report and progress log
