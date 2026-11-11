-- University OS — migration 2: academic core
-- Instructors, courses, topics, assessments (with grades), timetable, tasks, reminders, notes.
-- See migration 1 for the ownership model (composite FKs + generated RLS).

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text check (char_length(email) <= 254),
  office text check (char_length(office) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index instructors_user_idx on public.instructors(user_id);
create trigger instructors_updated_at before update on public.instructors
  for each row execute function private.set_updated_at();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period_id uuid not null,
  instructor_id uuid,
  code text check (char_length(code) <= 30),
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  credits numeric(4,1) not null default 0 check (credits >= 0 and credits <= 60),
  color text not null default 'violet' check (color in ('violet', 'blue', 'cyan', 'green', 'amber', 'rose', 'slate')),
  pinned boolean not null default false,
  include_in_gpa boolean not null default true,
  -- Optional personal goal for the final course percentage.
  target_percent numeric(5,2) check (target_percent between 0 and 100),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (period_id, user_id) references public.academic_periods(id, user_id) on delete cascade,
  foreign key (instructor_id, user_id) references public.instructors(id, user_id) on delete set null (instructor_id)
);
create index courses_period_idx on public.courses(user_id, period_id) where deleted_at is null;
create trigger courses_updated_at before update on public.courses
  for each row execute function private.set_updated_at();

create table public.course_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  position integer not null default 0,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'covered', 'mastered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete cascade
);
create index course_topics_course_idx on public.course_topics(course_id, position);
create trigger course_topics_updated_at before update on public.course_topics
  for each row execute function private.set_updated_at();

-- An assessment is a graded component of a course. `score` is NULL until graded.
-- Grades are never fabricated: imported values carry origin + imported_at.
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  kind text not null default 'assignment' check (kind in ('assignment', 'quiz', 'lab', 'project', 'midterm', 'final', 'exam', 'participation', 'other')),
  weight_percent numeric(6,3) not null check (weight_percent >= 0 and weight_percent <= 100),
  max_score numeric(10,3) not null default 100 check (max_score > 0),
  score numeric(10,3) check (score >= 0),
  due_at timestamptz,
  graded_at timestamptz,
  origin text not null default 'manual' check (origin in ('manual', 'csv', 'xlsx', 'ics', 'lms')),
  imported_at timestamptz,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete cascade
);
create index assessments_course_idx on public.assessments(course_id);
create index assessments_due_idx on public.assessments(user_id, due_at) where score is null;
create trigger assessments_updated_at before update on public.assessments
  for each row execute function private.set_updated_at();

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null,
  -- ISO weekday: 1 = Monday ... 7 = Sunday
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  kind text not null default 'lecture' check (kind in ('lecture', 'lab', 'seminar', 'tutorial', 'other')),
  location text check (char_length(location) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, user_id),
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete cascade
);
create index class_sessions_user_day_idx on public.class_sessions(user_id, weekday, starts_at);
create trigger class_sessions_updated_at before update on public.class_sessions
  for each row execute function private.set_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid,
  assessment_id uuid,
  parent_task_id uuid,
  kind text not null default 'task' check (kind in ('task', 'assignment')),
  title text not null check (char_length(title) between 1 and 300),
  notes text check (char_length(notes) <= 5000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  -- 0 low, 1 normal, 2 high, 3 urgent
  priority smallint not null default 1 check (priority between 0 and 3),
  due_at timestamptz,
  completed_at timestamptz,
  -- {"freq":"daily|weekly|monthly","interval":n}; next occurrence is created on completion.
  recurrence jsonb check (recurrence is null or (jsonb_typeof(recurrence) = 'object' and recurrence ? 'freq')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'done') = (completed_at is not null)),
  check (parent_task_id is null or parent_task_id <> id),
  unique (id, user_id),
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete set null (course_id),
  foreign key (assessment_id, user_id) references public.assessments(id, user_id) on delete set null (assessment_id),
  foreign key (parent_task_id, user_id) references public.tasks(id, user_id) on delete cascade
);
create index tasks_open_due_idx on public.tasks(user_id, due_at) where status <> 'done' and deleted_at is null;
create index tasks_course_idx on public.tasks(course_id) where deleted_at is null;
create index tasks_parent_idx on public.tasks(parent_task_id);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null,
  remind_at timestamptz not null,
  fired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, remind_at),
  foreign key (task_id, user_id) references public.tasks(id, user_id) on delete cascade
);
create index reminders_due_idx on public.reminders(user_id, remind_at) where fired_at is null;

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 50000),
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(title) > 0 or char_length(body) > 0),
  unique (id, user_id),
  foreign key (course_id, user_id) references public.courses(id, user_id) on delete set null (course_id)
);
create index notes_user_idx on public.notes(user_id, created_at desc) where deleted_at is null;
create trigger notes_updated_at before update on public.notes
  for each row execute function private.set_updated_at();

select private.enable_owner_rls('public.instructors');
select private.enable_owner_rls('public.courses');
select private.enable_owner_rls('public.course_topics');
select private.enable_owner_rls('public.assessments');
select private.enable_owner_rls('public.class_sessions');
select private.enable_owner_rls('public.tasks');
select private.enable_owner_rls('public.reminders');
select private.enable_owner_rls('public.notes');
