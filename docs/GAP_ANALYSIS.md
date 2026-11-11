# Feature gap analysis & roadmap

Legend: ✅ implemented **and tested** · 🟡 partial · 📋 planned (not started) · ⛔ blocked (needs a decision, credential or third party)

Compared: master specification (modules A–V) + the expansion update (sections 1–15) against the repository at the end of this session.

## Conflicts between the two documents, and how they were resolved

| Conflict | Resolution |
|---|---|
| Master spec: dark theme, purple/lavender accent → update: light **and** dark, navy/blue, green never primary | Update wins. Design tokens rebuilt; dark = graphite/navy + light-blue/cyan, light = white/navy/blue. Purple removed as brand colour. Green only in small status chips and as one optional course colour |
| Master spec: "AI Tutor is one of the most important modules" → update: tight budget, optional AI | AI is optional everywhere; core features never need a key. Tutor stays on the roadmap behind a verified free-tier provider |
| Master spec: Anthropic/OpenAI env vars → update: investigate Gemini | Provider abstraction kept; only a Gemini adapter exists (unverified). Old Anthropic/OpenAI env vars removed so the UI never implies unsupported providers work |
| Master spec: Supabase Auth → reality: no Supabase project/credentials available | Built a tested `local` auth provider behind an interface; Supabase provider is the first next-milestone item. Schema is Supabase-convention compatible |
| Master spec: "grade screenshot / OCR" → no AI key, no vision model | Not built; blocked on a configured provider. Never faked |
| Master spec: "summer school" not mentioned; update: don't claim it | Replaced by user-defined *requirements*; the app never states retake/summer-school outcomes unless the student configured the rule |
| Syllabus review: "only after approval saved permanently" vs. needing to store the upload to analyse it | Upload + draft are stored as **staging** (`documents`, `syllabus_imports`), clearly not courses; courses/topics/assessments are created only on approval; drafts can be discarded |

## Master specification modules

| Module | Status | Detail |
|---|---|---|
| A Dashboard | 🟡 | ✅ customizable widgets (show/hide/reorder, persisted): today's classes + free time, deadlines, exams, priority tasks, performance, pinned courses, quick notes. 📋 announcements, learning progress, SRS queue, projects, habits, AI briefing (shows honest "not available") |
| B Academic management | ✅/🟡 | ✅ years, periods, courses (active/completed/archived), topics, assessments, class schedule, instructors (name only), grades per period. 📋 instructor contact book, "academic history" views beyond GPA-by-period |
| C LMS/EDUS | ⛔ | Feasibility researched (docs/INTEGRATIONS.md): no verified API. 📋 ICS/CSV/XLSX import |
| D Timetable & attendance | 🟡 | ✅ weekly timetable, today view, free-time detection, monthly calendar of deadlines/exams. 📋 schedule changes, commute, attendance, ICS import |
| E AI tutor | 📋 | Retrieval foundation + citations exist (✅ FTS over chunks with page numbers); no model-backed tutoring |
| F Memory center / SRS | 📋 | — |
| G Tasks/deadlines | ✅/🟡 | ✅ tasks, subtasks, priority, due, recurring (verified one-next-occurrence), reminders, list + kanban, calendar. 📋 timeline view, AI breakdown, multiple configurable reminders in UI |
| H Grades | ✅/🟡 | ✅ weights validation, course grade, GPA (credit-weighted, scale-driven), required score, what-if, best/worst case, formulas shown, unreachable explained, requirements. 🟡 goal progress. 📋 screenshot import |
| I Chinese studio | 📋 | — |
| J Coding lab | 📋 | Requires an isolated sandbox; will stay disabled until one is configured |
| K Secretary | 📋 | Document search with citations is the foundation |
| L Personal life | 📋 | Notes only |
| M Voice notes | 📋 | — |
| N Group projects | 📋 | — |
| O Career | 📋 | — |
| P Second brain | 🟡 | ✅ upload (PDF/DOCX/TXT/MD/images stored), validation, extraction, chunking, full-text search with citations, per-course library. 📋 folders/tags, OCR, embeddings, summaries, cross-document Q&A |
| Q Gamification | 📋 | — |
| R Automation | 🟡 | ✅ deadline/reminder/overdue-digest generation (idempotent, restrained, user-mutable). 📋 weekly summaries, push, email, background worker |
| S Notification center | ✅ | categories, read/unread, filters, archive, snooze, deep links, per-category preferences |
| T Email assistant | 📋 | — |
| U Semester archive | 🟡 | ✅ archive periods/courses without data loss, GPA by period. 📋 side-by-side period comparison, reflections |
| V Workspace customization | 🟡 | ✅ widgets, pinned courses, sidebar, theme, period switcher. 📋 custom shortcuts |

## Expansion update

| # | Requirement | Status | Detail |
|---|---|---|---|
| 1 | Light + dark + system theme, persisted per user, no flash | ✅ | Tested: per-account adoption on a new browser, server-rendered theme without JS, system follows OS, mobile in both themes. ⚠ the "attached design reference" never arrived — visual design follows the written description |
| 2 | Syllabus-first workspace | ✅/🟡 | ✅ upload → extract → analyse (rules; AI optional) → review/edit → approve → course + topics + weighted assessments; materials upload; cited search; lifecycle. 🟡 dynamic per-course sections, folders, topic↔material linking UI (column exists), external links, notes per course. ⛔ scanned/image syllabi (need OCR/vision AI). 📋 quizzes/flashcards from materials, tutor Q&A |
| 3 | GPA / grade calculator | ✅/🟡 | See H. Distinct rules supported as *user-defined requirements*: pass course, pass final, "avoid retake", target letter, GPA targets. 🟡 "expected trimester GPA" = GPA so far (no cross-course projection). 📋 screenshot analysis |
| 4 | AI study planner | 📋 | Needs SRS + topic progress first |
| 5 | Smart calendar | 🟡 | Monthly view + deadlines/exams. 📋 day/week event views, drag-and-drop, conflict detection, holidays, personal events, ICS import, multi-step reminders |
| 6 | Attendance + risk overview | 📋 | Requirement evaluation (grades) is the first risk signal; no attendance data yet |
| 7 | AI learning tools / question bank | 📋 | — |
| 8 | Universal inbox | 🟡 | ✅ quick capture (task/note, keyboard C). 📋 inbox queue, links/screenshots/voice, AI classification with review |
| 9 | Student administration / secretary | 📋 | Document types include `regulation`; not surfaced yet |
| 10 | Collaboration | 📋 | Ownership model uses `user_id` + composite keys; sharing will need membership tables and per-resource policies — not started |
| 11 | Cost-conscious AI | 🟡 | ✅ provider abstraction, optional, consent, daily limit, usage ledger, caching, rules fallback. ⛔ Gemini adapter unverified (docs unreachable, no key) |
| 12 | Zero-budget infra | 🟡 | ✅ nothing paid is required; docs/COSTS.md. ⛔ Supabase never exercised |
| 13 | LMS integration investigation | ✅ (research) / ⛔ (sync) | docs/INTEGRATIONS.md |
| 14A Command palette | ✅ | ⌘K, navigation, create, search |
| 14B Universal search | 🟡 | courses, tasks, notes, assessments in the palette; materials via per-course search. 📋 flashcards, projects |
| 14C Export | ✅ | JSON (structured) + per-file download; ZIP bundle 📋 |
| 14D Account deletion | ✅ | email-confirmed; cascade verified for every table |
| 14E Backup/recovery | 🟡 | documented (docs/OPERATIONS.md); restore drill not automated |
| 14F Offline | 📋 | — |
| 14G Onboarding | 🟡 | account → profile → university → grading → calendar ✅; syllabus upload follows as the courses page's primary action; timetable setup and AI opt-in are optional later steps |
| 14H Accessibility | 🟡 | labels, focus rings, skip link, keyboard flows, reduced motion, `role`s. No automated a11y audit or measured contrast ratios yet |
| 14I Personalization | 🟡 | theme, widgets, week start, timezone, notification categories |

## Roadmap (dependency-ordered)

**Next milestone — "Make it deployable and intelligent (free)"**
1. Supabase Auth provider + run migrations and the RLS test-suite against a real Supabase project; Storage backend for files. *(unblocks hosting; verifies the Supabase claims)*
2. Verify the Gemini adapter with a real key; record real limits in docs/COSTS.md.
3. Flashcards + spaced repetition (FSRS or SM-2) + review history — works **without** AI; AI only drafts cards for review.
4. Attendance tracker + Academic Risk Overview (grades, requirements, deadlines, attendance — real stored data only).
5. ICS + CSV/XLSX import with preview/approve.

**Then:** AI tutor with RAG over existing chunks (citations already modelled) → quizzes/question bank → study planner → universal inbox with AI-suggested classification → student administration + secretary → calendar upgrade (week/day, DnD, conflicts) → PWA/offline capture → collaboration → Chinese studio / coding lab / career / gamification.

**Before any public launch:** email provider (reset + verification), MFA option, worker-isolated document parsing, shared rate-limit store, script-src CSP, Kazakhstan data-protection review, accessibility audit, dependency scanning in CI.
