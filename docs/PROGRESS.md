# Engineering report & progress log

_Branch `claude/magical-mayer-sl3v57`. Work is committed locally only: a push was attempted and blocked by the permission system, so it is NOT on the remote. No PR was opened and nothing was deployed._

## 1. Implemented
See README "What works today" and docs/GAP_ANALYSIS.md. Summary: accounts, RLS-isolated workspaces, onboarding, light/dark/system themes,
academic structure, courses + lifecycle, assessments/grades/GPA engine + requirements, timetable, tasks/board/calendar/notes/notifications,
dashboard + command palette + quick capture, documents/materials with cited search, syllabus-first import with review/approval, optional AI layer.

## 2. Fully functional (exercised end-to-end in a real browser against real Postgres)
Register → onboarding → syllabus upload → review → approve → course workspace → materials upload + cited search → enter grades →
required-final calculation (incl. unreachable) → requirements → archive/restore → reload persistence → second user repeats the flow
independently; themes; mobile layout; direct-API cross-user attacks; CSRF; bad uploads.

## 3. Actually tested (final run in this session)
| Check | Result |
|---|---|
| `tsc --noEmit` (strict) | pass |
| `eslint .` (Next + TS + React-hooks rules) | pass, 0 warnings |
| Unit tests (Vitest) | 56 passed — grade/GPA/requirements engine, time zones/recurrence, calendar suggestions, chunking, upload validation, syllabus extraction & evidence verification |
| DB tests (Vitest, real PostgreSQL 16) | 64 passed — migrations from scratch, auth provider, **RLS isolation matrix**, catalog guards, services, documents/FTS, syllabus flow, AI layer (stub), requirements, lifecycle |
| `next build` | pass (25 routes) |
| E2E (Playwright, production build, Chromium) | 11 passed, run twice consecutively with no flakes after fixing test-timing issues |
| Mutation check | Disabling RLS on one table made 9 isolation tests fail (tests are not vacuous) |

Not tested: Supabase (any part), live Gemini, real email, Safari/Firefox, load/performance, automated a11y, restore drill.

## 4. Remaining / incomplete
See docs/GAP_ANALYSIS.md (the authoritative list).

## 5. Database
`supabase/migrations/` — 4 forward-only migrations: (1) foundation + RLS helper, (2) academic core, (3) theme preference, (4) documents/chunks/syllabus imports/requirements/AI consent+usage/course lifecycle. ERD in docs/ARCHITECTURE.md. `db/local/00_supabase_shim.sql` is **local/test only**.

## 6. Authentication & RLS
Local provider (scrypt, hashed session tokens, rate limits) — implemented + tested. RLS on every table, composite ownership keys, append-only audit/usage tables, anon has no access — implemented + tested. Supabase Auth: **not implemented**.

## 7. AI integration
Provider abstraction + Gemini REST adapter used only for optional syllabus analysis. **Status: implemented against the commonly documented request shape but unverified against Google's docs (unreachable from the sandbox) and never run against the live API (no key).** Tested with a stub provider: consent gate, daily limit, usage ledger, caching, evidence verification, fallback on garbage output.

## 8. External integrations
Gemini — unverified; Supabase — not exercised; AITU LMS / EDUS — researched, no verified API, nothing connected; email — none.

## 10. Remaining bugs & security risks
See docs/OPERATIONS.md ("Known risks"). Highlights: in-process rate limiter; document parsing in the web process; no email verification/MFA/reset emails; no script-src CSP; Kazakhstan data-protection review outstanding; registration reveals existing emails.
Known product gaps: `/courses/[id]` and similar 404 pages are streamed with HTTP 200 (content is a not-found page; no data leaks) because of `loading.tsx`; course page "Open tasks" empty state shows two add buttons.

## 11–13. Setup, environment, Supabase
README (local), `.env.example` (variables), README "Supabase" (what is and is not ready).

## 14. Recommended next milestone
Docs/GAP_ANALYSIS.md → "Next milestone" (Supabase Auth + real-project RLS run → verify Gemini → flashcards/SRS → attendance/risk → ICS/CSV import).

## Decisions needed from you
1. **Design reference**: it did not arrive — resend it if you want the visuals matched more closely.
2. **Network allowlist**: `ai.google.dev` (Gemini docs) is not reachable from this environment, so the Gemini adapter could not be verified. Allowlist it (or paste the relevant docs) and supply a key to verify.
3. **Supabase project**: provide one (or confirm local-only for now) so the Supabase Auth provider and RLS suite can be verified against it.
4. **AITU IT**: ask whether Moodle web services/tokens are enabled for students; nothing can be integrated until that is confirmed.
5. **Hosting + email provider** choices before any public use.

## Progress log
- Phase 0: discovery (empty repo; Postgres 16 + Chromium available; no Supabase/AI keys; LMS/EDUS research).
- Phase 1: scaffold, schema + RLS, auth, services, grade engine, onboarding, shell, dashboard, command palette, notifications.
- Phase 2 (partial): courses, assessments/grades/GPA, timetable, tasks, calendar.
- Expansion: light/dark/system themes; documents + syllabus-first workflow; AI provider layer; grade requirements; course lifecycle; docs.
- Bugs found by tests and fixed: UTF-8 sniffing cut multibyte chars; JS `\b` ignored Cyrillic keywords; rule sentences mis-read as assessments; double "New course" dialog on `?new=1`; RLS catalog test caught export gaps for new tables.
