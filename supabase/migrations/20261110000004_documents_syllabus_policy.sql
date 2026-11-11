-- University OS — migration 4: course materials, syllabus import drafts, grading requirements,
-- course lifecycle, AI consent & usage tracking.
--
-- Storage note: file bytes live in `document_blobs` (PostgreSQL) so the app works on any Postgres with zero extra
-- services. On a Supabase free project the database is limited (see docs/COSTS.md); a Supabase Storage backend
-- can replace `document_blobs` behind the FileStore interface without schema changes to `documents`.

-- ---------------------------------------------------------------------------
-- Course lifecycle & grading policy
-- ---------------------------------------------------------------------------
alter table public.courses
  add column status text not null default 'active' check (status in ('active', 'completed', 'archived'));
create index courses_status_idx on public.courses(user_id, status) where deleted_at is null;

-- Allow syllabus-derived assessments to be labelled as such.
alter table public.assessments drop constraint assessments_origin_check;
alter table public.assessments add constraint assessments_origin_check
  check (origin in ('manual', 'csv', 'xlsx', 'ics', 'lms', 'syllabus', 'screenshot'));

-- Institution-specific rules. NULL = "not configured / unknown": the app never assumes a default.
alter table public.grading_scales
  add column pass_percent numeric(5,2) check (pass_percent between 0 and 100),
  add column min_final_percent numeric(5,2) check (min_final_percent between 0 and 100);

-- User-defined requirements the student wants tracked: "pass the course", "pass the final",
-- "avoid a retake (per my handbook)", "scholarship GPA", …  Thresholds are always entered by the user.
create table public.grade_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('course_percent', 'final_exam_percent', 'period_gpa', 'cumulative_gpa')),
  threshold numeric(6,3) not null check (threshold >= 0),
  -- Optional: restrict a course-level requirement to one course.
  course_id uuid,
  source_note text check (char_length(source_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete cascade
);
create index grade_requirements_user_idx on public.grade_requirements(user_id);
create trigger grade_requirements_updated_at before update on public.grade_requirements
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Documents (course materials), blobs, searchable chunks
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid,
  topic_id uuid,
  kind text not null default 'other' check (kind in ('syllabus', 'lecture', 'textbook', 'assignment', 'regulation', 'other')),
  title text not null check (char_length(title) between 1 and 300),
  original_filename text not null check (char_length(original_filename) <= 255),
  mime_type text not null check (char_length(mime_type) <= 120),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 15 * 1024 * 1024),
  -- Content hash: identical files are never re-processed (saves time and AI spend).
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'processing' check (status in ('processing', 'ready', 'needs_ocr', 'failed')),
  status_detail text check (char_length(status_detail) <= 500),
  page_count integer,
  char_count integer,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete set null (course_id),
  foreign key (topic_id, user_id) references public.course_topics(id, user_id) on delete set null (topic_id)
);
-- A user can hold a given file once per course (re-uploading the same file is an idempotent no-op).
create unique index documents_unique_file_idx on public.documents(user_id, sha256, coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid)) where deleted_at is null;
create index documents_course_idx on public.documents(user_id, course_id) where deleted_at is null;
create trigger documents_updated_at before update on public.documents
  for each row execute function private.set_updated_at();

create table public.document_blobs (
  document_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data bytea not null,
  foreign key (document_id, user_id) references public.documents(id, user_id) on delete cascade
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  -- Page for PDFs (1-based); NULL for formats without pages. Used for citations.
  page_number integer check (page_number >= 1),
  content text not null check (char_length(content) between 1 and 4000),
  -- 'simple' = language-agnostic tokenisation (no stemming): works for English/Russian/Kazakh text.
  tsv tsvector generated always as (to_tsvector('simple', content)) stored,
  unique (document_id, chunk_index),
  foreign key (document_id, user_id) references public.documents(id, user_id) on delete cascade
);
create index document_chunks_tsv_idx on public.document_chunks using gin (tsv);
create index document_chunks_doc_idx on public.document_chunks(document_id, chunk_index);

-- ---------------------------------------------------------------------------
-- Syllabus import drafts. Nothing here is a course: a draft becomes courses/topics/assessments
-- only when the student approves it (tests/db/syllabus.test.ts).
-- ---------------------------------------------------------------------------
create table public.syllabus_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null,
  period_id uuid,
  status text not null default 'draft' check (status in ('draft', 'approved', 'discarded')),
  method text not null check (method in ('rules', 'ai')),
  provider text,
  extracted jsonb not null check (jsonb_typeof(extracted) = 'object'),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  created_course_id uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (document_id, user_id) references public.documents(id, user_id) on delete cascade,
  foreign key (period_id, user_id) references public.academic_periods(id, user_id) on delete set null (period_id),
  foreign key (created_course_id, user_id) references public.courses(id, user_id) on delete set null (created_course_id)
);
create index syllabus_imports_user_idx on public.syllabus_imports(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI: explicit consent + usage ledger (rate limiting, cost visibility)
-- ---------------------------------------------------------------------------
alter table public.user_preferences add column ai_consent_at timestamptz;

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null,
  model text not null,
  task text not null check (char_length(task) <= 60),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- NULL = unknown / free tier. We never invent a cost.
  est_cost_usd numeric(10,6),
  created_at timestamptz not null default now()
);
create index ai_usage_user_day_idx on public.ai_usage(user_id, created_at desc);

select private.enable_owner_rls('public.grade_requirements');
select private.enable_owner_rls('public.documents');
select private.enable_owner_rls('public.document_blobs');
select private.enable_owner_rls('public.document_chunks');
select private.enable_owner_rls('public.syllabus_imports');
-- The usage ledger is append-only for the user it belongs to.
select private.enable_owner_rls('public.ai_usage', delete_allowed => false, update_allowed => false);
