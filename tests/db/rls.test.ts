import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminSql, appSql, closeAll, createOnboardedUser, withUser } from "./helpers";
import { seedWorkspace } from "./seed";
import { EXPORT_EXCLUDED, EXPORT_TABLES } from "@/server/services/export";

afterAll(closeAll);

type Ws = Awaited<ReturnType<typeof createOnboardedUser>> & Awaited<ReturnType<typeof seedWorkspace>>;
let A: Ws;
let B: Ws;

beforeAll(async () => {
  const a = await createOnboardedUser("alice");
  const b = await createOnboardedUser("bob");
  A = { ...a, ...(await seedWorkspace(a.userId, a.periodId)) };
  B = { ...b, ...(await seedWorkspace(b.userId, b.periodId)) };
});

const code = async (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code ?? "unknown");

describe("catalog: every user-owned table is protected", () => {
  it("has RLS enabled and explicit policies on every table in public", async () => {
    const tables = await adminSql()<{ name: string; rls: boolean; policies: number; hasUserCol: boolean }[]>`
      select c.relname as name, c.relrowsecurity as rls,
        (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
        exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name in ('user_id')) as has_user_col
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'schema_migrations'`;
    expect(tables.length).toBeGreaterThan(15);
    for (const t of tables) {
      expect(t.rls, `RLS disabled on ${t.name}`).toBe(true);
      expect(Number(t.policies), `no policies on ${t.name}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("every table with a user_id is covered by the data export (so export/deletion cannot silently miss a table)", async () => {
    const owned = await adminSql()<{ name: string }[]>`
      select table_name as name from information_schema.columns where table_schema = 'public' and column_name = 'user_id'
        and table_name <> 'user_preferences' order by 1`;
    const exported = new Set<string>([...EXPORT_TABLES, ...Object.keys(EXPORT_EXCLUDED)]);
    expect(owned.map((o) => o.name).filter((n) => !exported.has(n))).toEqual([]);
  });

  it("every user_id column is a NOT NULL foreign key to auth.users with ON DELETE CASCADE", async () => {
    const rows = await adminSql()<{ table: string; nullable: string; cascade: boolean }[]>`
      select k.table_name as "table", k.is_nullable as nullable,
        exists (select 1 from pg_constraint c where c.conrelid = format('public.%I', k.table_name)::regclass and c.contype = 'f'
          and c.confrelid = 'auth.users'::regclass and c.confdeltype = 'c') as cascade
      from information_schema.columns k where k.table_schema = 'public' and k.column_name = 'user_id'`;
    for (const r of rows) {
      expect(r.nullable, r.table).toBe("NO");
      expect(r.cascade, r.table).toBe(true);
    }
  });

  it("the anonymous role cannot read or write anything", async () => {
    for (const t of [...EXPORT_TABLES, "profiles", "user_preferences"]) {
      const c = await code(appSql().begin(async (tx) => { await tx`set local role anon`; await tx.unsafe(`select * from public.${t}`); }));
      expect(c, t).toBe("42501");
    }
  });

  it("an authenticated session without a user id sees nothing", async () => {
    const rows = await appSql().begin(async (tx) => {
      await tx`set local role authenticated`;
      return tx`select id from courses`;
    });
    expect(rows).toHaveLength(0);
  });
});

describe("User B cannot read, modify or delete User A's records", () => {
  it("sees none of A's rows in any table", async () => {
    await withUser(B.userId, async (tx) => {
      for (const t of EXPORT_TABLES) {
        const rows = await tx.unsafe(`select user_id from public.${t}`);
        expect(rows.every((r) => r.userId === B.userId), `${t} leaked rows`).toBe(true);
      }
      expect(await tx`select 1 from profiles where id = ${A.userId}`).toHaveLength(0);
      expect(await tx`select 1 from user_preferences where user_id = ${A.userId}`).toHaveLength(0);
    });
  });

  it("cannot fetch A's records by primary key", async () => {
    await withUser(B.userId, async (tx) => {
      expect(await tx`select 1 from courses where id = ${A.courseId}`).toHaveLength(0);
      expect(await tx`select 1 from tasks where id = ${A.taskId}`).toHaveLength(0);
      expect(await tx`select 1 from notes where id = ${A.noteId}`).toHaveLength(0);
      expect(await tx`select 1 from assessments where id = ${A.assessmentId}`).toHaveLength(0);
      expect(await tx`select 1 from class_sessions where id = ${A.sessionId}`).toHaveLength(0);
    });
  });

  it("updates and deletes on A's rows affect nothing", async () => {
    await withUser(B.userId, async (tx) => {
      expect(await tx`update courses set title = 'pwned' where id = ${A.courseId} returning id`).toHaveLength(0);
      expect(await tx`update assessments set score = 0 where id = ${A.assessmentId} returning id`).toHaveLength(0);
      expect(await tx`update tasks set status = 'done', completed_at = now() where id = ${A.taskId} returning id`).toHaveLength(0);
      expect(await tx`update profiles set display_name = 'pwned' where id = ${A.userId} returning id`).toHaveLength(0);
      expect(await tx`update user_preferences set sidebar_collapsed = true where user_id = ${A.userId} returning user_id`).toHaveLength(0);
      expect(await tx`delete from courses where id = ${A.courseId} returning id`).toHaveLength(0);
      expect(await tx`delete from notes where id = ${A.noteId} returning id`).toHaveLength(0);
      expect(await tx`delete from notifications where user_id = ${A.userId} returning id`).toHaveLength(0);
    });
    // A's data is intact.
    await withUser(A.userId, async (tx) => {
      const [c] = await tx`select title from courses where id = ${A.courseId}`;
      expect(c!.title).toBe("Calculus I");
      const [a] = await tx`select score from assessments where id = ${A.assessmentId}`;
      expect(a!.score).toBe(88);
      const [p] = await tx`select display_name from profiles`;
      expect(p!.displayName).not.toBe("pwned");
    });
  });

  it("cannot insert rows owned by A", async () => {
    await withUser(B.userId, async (tx) => {
      for (const stmt of [
        `insert into notes (user_id, title) values ('${A.userId}', 'planted')`,
        `insert into instructors (user_id, name) values ('${A.userId}', 'planted')`,
        `insert into audit_logs (user_id, action) values ('${A.userId}', 'planted')`,
      ]) {
        // Each statement needs its own savepoint so a failure doesn't abort the transaction.
        const c = await code(tx.savepoint((sp) => sp.unsafe(stmt)));
        expect(c, stmt).toBe("42501");
      }
    });
  });

  it("cannot reassign own rows to A (user_id is immutable under RLS)", async () => {
    await withUser(B.userId, async (tx) => {
      const c = await code(tx.savepoint((sp) => sp`update notes set user_id = ${A.userId} where id = ${B.noteId}`));
      expect(c).toBe("42501");
    });
  });

  it("cannot attach own rows to A's parents (composite ownership foreign keys)", async () => {
    await withUser(B.userId, async (tx) => {
      const cases: [string, () => Promise<unknown>][] = [
        ["task→A course", () => tx.savepoint((sp) => sp`insert into tasks (title, course_id) values ('x', ${A.courseId})`)],
        ["assessment→A course", () => tx.savepoint((sp) => sp`insert into assessments (course_id, title, weight_percent) values (${A.courseId}, 'x', 10)`)],
        ["class session→A course", () => tx.savepoint((sp) => sp`insert into class_sessions (course_id, weekday, starts_at, ends_at) values (${A.courseId}, 1, '09:00', '10:00')`)],
        ["course→A period", () => tx.savepoint((sp) => sp`insert into courses (period_id, title) values (${A.periodId}, 'x')`)],
        ["note→A course", () => tx.savepoint((sp) => sp`insert into notes (title, course_id) values ('x', ${A.courseId})`)],
        ["reminder→A task", () => tx.savepoint((sp) => sp`insert into reminders (task_id, remind_at) values (${A.taskId}, now())`)],
        ["prefs.active_period→A period", () => tx.savepoint((sp) => sp`update user_preferences set active_period_id = ${A.periodId}`)],
      ];
      for (const [label, run] of cases) expect(await code(run()), label).toBe("23503");
    });
  });

  it("audit logs are append-only even for their owner", async () => {
    await withUser(B.userId, async (tx) => {
      expect(await code(tx.savepoint((sp) => sp`update audit_logs set action = 'tampered'`))).toBe("42501");
      expect(await code(tx.savepoint((sp) => sp`delete from audit_logs`))).toBe("42501");
    });
  });

  it("users cannot read credentials, sessions or auth.users", async () => {
    await withUser(B.userId, async (tx) => {
      expect(await code(tx.savepoint((sp) => sp`select * from auth.users`))).toBe("42501");
      expect(await code(tx.savepoint((sp) => sp`select * from local_auth.credentials`))).toBe("42501");
      expect(await code(tx.savepoint((sp) => sp`select * from local_auth.sessions`))).toBe("42501");
    });
  });

  it("users cannot create tables or escalate (no DDL, cannot set role to postgres)", async () => {
    await withUser(B.userId, async (tx) => {
      expect(await code(tx.savepoint((sp) => sp`create table public.evil (id int)`))).toBe("42501");
      expect(await code(tx.savepoint((sp) => sp`set local role postgres`))).toBe("42501");
    });
  });

  it("role/identity does not leak between pooled connections", async () => {
    // Run many alternating transactions over a small pool; each must see only its own data.
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => {
        const who = i % 2 === 0 ? A : B;
        return withUser(who.userId, async (tx) => ({ who: who.userId, rows: await tx`select user_id from notes` }));
      }),
    );
    for (const r of results) {
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.rows.every((x) => x.userId === r.who)).toBe(true);
    }
    const outside = await appSql()`select current_user as u`;
    expect(outside[0]!.u).toBe("app_server");
  });
});

describe("cross-user isolation through the service layer", () => {
  it("lists only own courses/tasks/notes and cannot fetch A's by id", async () => {
    const { listCourses, getCourse } = await import("@/server/services/courses");
    const { listTasks, getTask } = await import("@/server/services/tasks");
    const { listNotes } = await import("@/server/services/notes");
    await withUser(B.userId, async (tx) => {
      expect((await listCourses(tx)).map((c) => c.id)).toEqual([B.courseId]);
      expect((await listTasks(tx, { status: "all", limit: 50 })).map((t) => t.id)).toEqual([B.taskId]);
      expect((await listNotes(tx)).map((n) => n.id)).toEqual([B.noteId]);
      await expect(getCourse(tx, A.courseId)).rejects.toMatchObject({ code: "not_found" });
      await expect(getTask(tx, A.taskId)).rejects.toMatchObject({ code: "not_found" });
    });
  });

  it("search never returns another user's data", async () => {
    const { searchAll } = await import("@/server/services/search");
    await withUser(B.userId, async (tx) => {
      const hits = await searchAll(tx, "Calculus");
      expect(hits.map((h) => h.id)).toContain(B.courseId);
      expect(hits.map((h) => h.id)).not.toContain(A.courseId);
    });
  });

  it("service writes against A's ids fail for B", async () => {
    const { updateCourse, addAssessment, updateAssessment, deleteCourse } = await import("@/server/services/courses");
    const { updateTask } = await import("@/server/services/tasks");
    await withUser(B.userId, async (tx) => {
      await expect(updateCourse(tx, A.courseId, { title: "pwned" })).rejects.toMatchObject({ code: "not_found" });
      await expect(addAssessment(tx, A.courseId, { title: "x", weightPercent: 10 })).rejects.toMatchObject({ code: "not_found" });
      await expect(updateAssessment(tx, A.assessmentId, { score: 0 })).rejects.toMatchObject({ code: "not_found" });
      await expect(deleteCourse(tx, A.courseId)).rejects.toMatchObject({ code: "not_found" });
      await expect(updateTask(tx, A.taskId, { status: "done" }, "UTC")).rejects.toMatchObject({ code: "not_found" });
    });
  });

  it("export contains only the caller's rows", async () => {
    const { exportAllData } = await import("@/server/services/export");
    const data = (await withUser(B.userId, exportAllData)) as Record<string, { userId?: string }[]>;
    for (const t of EXPORT_TABLES) expect(data[t]!.every((r) => r.userId === B.userId), t).toBe(true);
    expect(JSON.stringify(data)).not.toContain(A.userId);
  });

  it("deleting A removes all of A's data and leaves B untouched", async () => {
    const victim = await createOnboardedUser("victim");
    await seedWorkspace(victim.userId, victim.periodId);
    const { localAuthProvider } = await import("./helpers");
    await localAuthProvider.deleteUser(victim.userId);
    for (const t of EXPORT_TABLES) {
      const [r] = (await adminSql().unsafe(`select count(*)::int as n from public.${t} where user_id = '${victim.userId}'`)) as unknown as [{ n: number }];
      expect(r.n, t).toBe(0);
    }
    await withUser(B.userId, async (tx) => expect(await tx`select 1 from courses`).toHaveLength(1));
  });
});
