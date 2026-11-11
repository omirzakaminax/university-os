# Architecture

## Stack (and why)

| Concern | Choice | Notes |
|---|---|---|
| App | Next.js 16 App Router, React 19, strict TypeScript | Server Components for data pages; Server Actions for the web UI; `/api/v1` REST for future mobile clients |
| Styling | Tailwind CSS 4 + CSS-variable design tokens | Light/dark palettes defined once in `src/app/globals.css`; components use semantic tokens only |
| DB | PostgreSQL (Supabase-compatible schema) | Driver: `postgres` (no ORM). SQL migrations in `supabase/migrations` |
| Search | PostgreSQL full-text search (`simple` config) | Free; no vector DB. Substring fallback for Chinese. Embeddings are a later, optional add-on |
| Files | PostgreSQL `bytea` (`document_blobs`) | Zero extra services. Swappable for Supabase Storage (see COSTS.md for the 500 MB DB limit) |
| Extraction | `unpdf` (pdf.js), `mammoth` | Open source, in-process, no paid OCR. Scans/images need an AI provider |
| AI | Provider abstraction + Gemini REST adapter | Optional; consent + daily limit + usage ledger; **adapter unverified against live API** |
| Tests | Vitest (unit + real Postgres), Playwright | RLS is tested against a real database, not mocked |

## Layers

```
UI (Server/Client Components)  ──►  Server Actions (src/app/actions)   ┐
Mobile / 3rd-party clients     ──►  REST /api/v1 (src/app/api/v1)      ├─► Services (src/server/services) ─► SQL
                                                                        ┘      pure domain logic: src/domain
```

- **`src/domain`** — pure, unit-tested logic: grade/GPA engine, requirements, syllabus extraction & verification, chunking, upload validation, time zones, recurrence.
- **`src/server/services`** — one file per aggregate; every function takes a transaction `tx` that is already user-scoped.
- **`src/server/runtime.ts` / `api.ts`** — the only entry points: authenticate → rate-limit → open an RLS-scoped transaction → validate input with zod → call a service → map errors to a safe envelope.
- All validation lives in `src/server/schemas.ts` and is shared by actions and REST.

## Ownership model & Row Level Security

Every private row has `user_id uuid not null default auth.uid() references auth.users on delete cascade`.

1. **Per-request identity.** `withUser(userId, fn)` opens a transaction, sets `request.jwt.claims` (what `auth.uid()` reads) and `SET LOCAL ROLE authenticated`. The role switch is transaction-local, so pooled connections cannot leak identity (tested with 40 interleaved transactions).
2. **Generated policies.** `private.enable_owner_rls(table)` creates select/insert/update/delete owner policies; append-only tables (`audit_logs`, `ai_usage`) get no update/delete grants.
3. **Composite ownership foreign keys.** Child→parent references are `(child_id, user_id) → parent(id, user_id)`. FK checks bypass RLS, so a plain FK would let user B attach rows to user A's UUID. Composite keys make that impossible (tested for every relation).
4. **Catalog tests** fail the build if any `public` table lacks RLS/policies, any `user_id` is nullable or not cascading, or a user-owned table is missing from export/deletion handling.
5. `anon` has no grants. `auth.users` and `local_auth.*` are unreachable from `authenticated`.

## Auth

`AuthProvider` interface (`src/server/auth/provider.ts`).

- **Implemented: `local`** — scrypt password hashes, opaque 256-bit session tokens (only SHA-256 stored), httpOnly cookie or `Authorization: Bearer` for mobile, rate-limited login/register/reset, generic login error + constant-ish timing, password reset signs out all devices, CSRF origin check on cookie-authenticated mutations. Tables live in `local_auth` (created by the local shim).
- **Planned (next milestone, first item): `supabase`** — GoTrue via REST, same interface. The data layer is already compatible (it only needs `auth.uid()`).
- No email provider → reset links are never emailed; in development they can be shown on screen (`AUTH_DEV_SHOW_RESET_LINK=1`, ignored in production).

## AI

`src/server/ai`: `LlmProvider.generateJson({task, tier, system, user})`. `runJson()` enforces: provider configured → user consent (`user_preferences.ai_consent_at`) → daily limit (`AI_DAILY_REQUEST_LIMIT`) → call → ledger row (`ai_usage`, cost stored as NULL, never invented).
Syllabus AI output is zod-validated **and verified against the source text** (quoted evidence must exist and contain the claimed weight/date); unverified items are flagged. On any AI failure the free rules-based extractor is used. Identical documents/drafts are cached, so repeated clicks cost nothing. Document text is passed as data inside tags with an explicit "ignore instructions in the document" system prompt (prompt-injection defence — a mitigation, not a guarantee; output is also schema-validated and never executed).

## Syllabus-first flow

`upload → validate by magic bytes → SHA-256 dedupe → store → extract → chunk (page-aware) → index (tsvector)` → `analyze` (rules, or AI if enabled) → **`syllabus_imports` draft** (not a course) → review UI → `approve` (single transaction: course, instructor, topics, assessments with origin `syllabus`, document attached) → draft marked approved (second approval is a conflict).

## ERD (implemented tables)

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : has
  AUTH_USERS ||--|| USER_PREFERENCES : has
  AUTH_USERS ||--o{ INSTITUTIONS : owns
  INSTITUTIONS ||--o{ GRADING_SCALES : "uses"
  GRADING_SCALES ||--|{ GRADING_SCALE_BANDS : defines
  INSTITUTIONS ||--o{ ACADEMIC_PROGRAMS : offers
  ACADEMIC_PROGRAMS ||--o{ ACADEMIC_YEARS : has
  ACADEMIC_YEARS ||--o{ ACADEMIC_PERIODS : has
  ACADEMIC_PERIODS ||--o{ COURSES : contains
  INSTRUCTORS ||--o{ COURSES : teaches
  COURSES ||--o{ COURSE_TOPICS : has
  COURSES ||--o{ ASSESSMENTS : "graded by"
  COURSES ||--o{ CLASS_SESSIONS : meets
  COURSES ||--o{ TASKS : "linked to"
  TASKS ||--o{ TASKS : subtasks
  TASKS ||--o{ REMINDERS : has
  COURSES ||--o{ NOTES : "linked to"
  COURSES ||--o{ DOCUMENTS : materials
  DOCUMENTS ||--|| DOCUMENT_BLOBS : bytes
  DOCUMENTS ||--o{ DOCUMENT_CHUNKS : "indexed as"
  DOCUMENTS ||--o{ SYLLABUS_IMPORTS : "analysed into"
  SYLLABUS_IMPORTS }o--o| COURSES : "approved as"
  AUTH_USERS ||--o{ GRADE_REQUIREMENTS : defines
  AUTH_USERS ||--o{ NOTIFICATIONS : receives
  AUTH_USERS ||--o{ AUDIT_LOGS : "appends"
  AUTH_USERS ||--o{ AI_USAGE : "appends"
```

Every edge above is a composite `(id, user_id)` key except those from `auth.users`.

## Key decisions / trade-offs

- **No ORM**: explicit SQL keeps RLS and composite keys visible; cost is more hand-written queries.
- **Files in Postgres**: simplest and portable; heavy use will hit free-tier DB limits → move to object storage behind the same service functions.
- **Notifications are generated lazily** on page load (idempotent dedupe keys) because no background worker exists; a scheduled worker would call the same function.
- **Rate limiting is in-memory** (per process); use a shared store when running several instances.
- **Not done:** pgvector/embeddings (FTS only), background jobs, realtime, Supabase Auth/Storage.
