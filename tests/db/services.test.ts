import { afterAll, describe, expect, it } from "vitest";
import { closeAll, createOnboardedUser, createUser, ONBOARDING, withUser } from "./helpers";
import { completeOnboarding, getPreferences, getProfile, updatePreferences } from "@/server/services/profile";
import { getAcademicContext, createPeriod, createYear, replaceScaleBands } from "@/server/services/academics";
import { addAssessment, addTopic, createCourse, deleteCourse, getCourse, listAssessments, listCourses, updateAssessment, updateCourse } from "@/server/services/courses";
import { createTask, deleteTask, listTasks, updateTask } from "@/server/services/tasks";
import { applyNotificationAction, listNotifications, syncNotifications, unreadCount } from "@/server/services/notifications";
import { searchAll } from "@/server/services/search";
import { loadDashboard } from "@/server/services/dashboard";
import { gpaFor, loadGradebook } from "@/server/services/grades";
import { createSession, sessionsOnDate } from "@/server/services/timetable";
import { normalizeError } from "@/server/errors";
import { assessmentCreateSchema, taskCreateSchema } from "@/server/schemas";

afterAll(closeAll);

describe("onboarding", () => {
  it("creates an independent academic workspace and is not repeatable", async () => {
    const u = await createUser("onb");
    await withUser(u.userId, async (tx) => {
      const { activePeriodId } = await completeOnboarding(tx, ONBOARDING);
      const profile = await getProfile(tx);
      expect(profile.onboardingCompletedAt).not.toBeNull();
      expect(profile.timezone).toBe("Asia/Almaty");
      const ctx = await getAcademicContext(tx, "2026-11-10");
      expect(ctx?.institution.name).toBe("Astana IT University");
      expect(ctx?.periods).toHaveLength(2);
      expect(ctx?.activePeriod.id).toBe(activePeriodId);
      expect(ctx?.scale.bands).toHaveLength(11);
      await expect(completeOnboarding(tx, ONBOARDING)).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("rejects malformed grading scales and bad dates without writing anything", async () => {
    const u = await createUser("onb2");
    await withUser(u.userId, async (tx) => {
      const bad = { ...ONBOARDING, grading: { ...ONBOARDING.grading, bands: [{ letter: "A", minPercent: 50, points: 4 }] } };
      await expect(completeOnboarding(tx, bad)).rejects.toMatchObject({ code: "validation" });
    });
    await withUser(u.userId, async (tx) => {
      expect((await getProfile(tx)).onboardingCompletedAt).toBeNull();
      expect(await tx`select 1 from institutions`).toHaveLength(0);
    });
  });

  it("two new users start with completely separate, empty workspaces", async () => {
    const a = await createUser("sep-a");
    const b = await createUser("sep-b");
    await withUser(a.userId, (tx) => completeOnboarding(tx, ONBOARDING));
    await withUser(b.userId, async (tx) => {
      expect(await getAcademicContext(tx, "2026-11-10")).toBeNull();
      expect(await listCourses(tx)).toHaveLength(0);
    });
  });
});

describe("academics", () => {
  it("resolves the active period, adds years/periods, and edits the grading scale", async () => {
    const u = await createOnboardedUser("acad");
    await withUser(u.userId, async (tx) => {
      const ctx = (await getAcademicContext(tx, "2026-12-20"))!;
      expect(ctx.activePeriod.id).toBe(u.periodId); // explicit preference wins over date
      await updatePreferences(tx, { activePeriodId: null });
      expect((await getAcademicContext(tx, "2026-12-20"))!.activePeriod.name).toBe("Trimester 2"); // by date
      expect((await getAcademicContext(tx, "2030-01-01"))!.activePeriod.name).toBe("Trimester 2"); // most recent started
      const y = await createYear(tx, { programId: ctx.program.id, label: "2027–2028", startsOn: "2027-09-01", endsOn: "2028-06-30" });
      await createPeriod(tx, { academicYearId: y.id, name: "Trimester 1", kind: "trimester", startsOn: "2027-09-01", endsOn: "2027-12-15" });
      const dup = await tx.savepoint((sp) => createPeriod(sp, { academicYearId: y.id, name: "Trimester 1", kind: "trimester", startsOn: "2027-09-01", endsOn: "2027-12-15" })).catch(normalizeError);
      expect(dup).toMatchObject({ code: "conflict" }); // raw 23505 is translated at the API boundary
      await expect(createPeriod(tx, { academicYearId: y.id, name: "Bad", kind: "custom", startsOn: "2027-12-15", endsOn: "2027-09-01" })).rejects.toMatchObject({ code: "validation" });
      await replaceScaleBands(tx, ctx.scale.id, [{ letter: "P", minPercent: 50, points: 1 }, { letter: "F", minPercent: 0, points: 0 }], "half_up");
      expect((await getAcademicContext(tx, "2026-11-10"))!.scale.bands.map((b) => b.letter)).toEqual(["P", "F"]);
      await expect(replaceScaleBands(tx, ctx.scale.id, [{ letter: "P", minPercent: 50, points: 1 }], "none")).rejects.toMatchObject({ code: "validation" });
    });
  });
});

describe("courses, assessments and grades", () => {
  it("creates courses, reuses instructors, soft-deletes, and keeps weights/grades consistent", async () => {
    const u = await createOnboardedUser("course");
    await withUser(u.userId, async (tx) => {
      const { id } = await createCourse(tx, { periodId: u.periodId, title: "C++ Programming", code: "CS102", credits: 5, instructorName: "Dr. Smith" });
      await createCourse(tx, { periodId: u.periodId, title: "Chinese", credits: 3, instructorName: "dr. smith" });
      expect(await tx`select 1 from instructors`).toHaveLength(1);
      await addTopic(tx, id, { title: "Pointers" });
      await updateCourse(tx, id, { pinned: true, targetPercent: 90 });
      expect((await getCourse(tx, id)).pinned).toBe(true);

      await addAssessment(tx, id, { title: "Labs", kind: "lab", weightPercent: 30, score: 90 });
      const final = await addAssessment(tx, id, { title: "Final", kind: "final", weightPercent: 70, dueAt: "2026-12-10T05:00:00Z" });
      const ctx = (await getAcademicContext(tx, "2026-11-10"))!;
      let book = await loadGradebook(tx, ctx.scale);
      let c = book.find((x) => x.id === id)!;
      expect(c.grade.currentPercent).toBeCloseTo(90);
      expect(c.grade.weightsValid).toBe(true);
      expect(c.grade.isFinal).toBe(false);

      await updateAssessment(tx, final.id, { score: 80 });
      book = await loadGradebook(tx, ctx.scale);
      c = book.find((x) => x.id === id)!;
      expect(c.grade.finalPercent).toBeCloseTo(83); // 27 + 56
      expect(c.grade.letter).toBe("B");
      const gpa = gpaFor(book, ctx.scale);
      expect(gpa.courses).toHaveLength(1); // Chinese has no graded work
      expect(gpa.gpa).toBe(3);

      const [graded] = await listAssessments(tx, id).then((r) => r.filter((a) => a.id === final.id));
      expect(graded!.gradedAt).not.toBeNull();
      await updateAssessment(tx, final.id, { score: null });
      expect((await listAssessments(tx, id)).find((a) => a.id === final.id)!.gradedAt).toBeNull();

      await deleteCourse(tx, id);
      await expect(getCourse(tx, id)).rejects.toMatchObject({ code: "not_found" });
      expect((await loadGradebook(tx, ctx.scale)).map((x) => x.id)).not.toContain(id);
    });
  });

  it("enforces input contracts (negative scores, weights over 100)", () => {
    expect(assessmentCreateSchema.safeParse({ title: "x", weightPercent: 120 }).success).toBe(false);
    expect(assessmentCreateSchema.safeParse({ title: "x", weightPercent: 10, score: -1 }).success).toBe(false);
    expect(assessmentCreateSchema.safeParse({ title: "x", weightPercent: 10, maxScore: 0 }).success).toBe(false);
    expect(assessmentCreateSchema.safeParse({ title: "x", weightPercent: 10, dueAt: "tomorrow" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: "" }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: "ok", priority: 9 }).success).toBe(false);
  });

  it("database check constraints reject invalid values even if the API layer is bypassed", async () => {
    const u = await createOnboardedUser("chk");
    await withUser(u.userId, async (tx) => {
      const { id } = await createCourse(tx, { periodId: u.periodId, title: "X" });
      const code = (p: Promise<unknown>) => p.then(() => null, (e: { code?: string }) => e.code);
      expect(await code(tx.savepoint((sp) => sp`insert into assessments (course_id, title, weight_percent) values (${id}, 'x', 101)`))).toBe("23514");
      expect(await code(tx.savepoint((sp) => sp`insert into assessments (course_id, title, weight_percent, score) values (${id}, 'x', 10, -5)`))).toBe("23514");
      expect(await code(tx.savepoint((sp) => sp`insert into class_sessions (course_id, weekday, starts_at, ends_at) values (${id}, 8, '09:00', '10:00')`))).toBe("23514");
      expect(await code(tx.savepoint((sp) => sp`insert into class_sessions (course_id, weekday, starts_at, ends_at) values (${id}, 1, '10:00', '09:00')`))).toBe("23514");
      expect(await code(tx.savepoint((sp) => sp`insert into tasks (title, status) values ('x', 'done')`))).toBe("23514"); // done requires completed_at
    });
  });
});

describe("tasks", () => {
  it("creates, completes, reopens, soft-deletes and filters", async () => {
    const u = await createOnboardedUser("task");
    await withUser(u.userId, async (tx) => {
      const t = await createTask(tx, { title: "Write report", priority: 3, dueAt: "2026-11-20T10:00:00Z" });
      const sub = await createTask(tx, { title: "Outline", parentTaskId: t.id });
      expect(sub.parentTaskId).toBe(t.id);
      const done = await updateTask(tx, t.id, { status: "done" }, "UTC");
      expect(done.status).toBe("done");
      expect(done.completedAt).not.toBeNull();
      expect((await listTasks(tx, { status: "open", limit: 50 })).map((x) => x.id)).toEqual([sub.id]);
      expect((await listTasks(tx, { status: "done", limit: 50 })).map((x) => x.id)).toEqual([t.id]);
      const reopened = await updateTask(tx, t.id, { status: "todo" }, "UTC");
      expect(reopened.completedAt).toBeNull();
      await deleteTask(tx, t.id);
      expect((await listTasks(tx, { status: "all", limit: 50 })).map((x) => x.id)).toEqual([]); // subtask deleted with parent
    });
  });

  it("completing a recurring task schedules exactly one next occurrence", async () => {
    const u = await createOnboardedUser("recur");
    await withUser(u.userId, async (tx) => {
      const t = await createTask(tx, { title: "Weekly quiz prep", dueAt: "2026-11-10T18:59:00Z", recurrence: { freq: "weekly", interval: 1 } });
      await updateTask(tx, t.id, { status: "done" }, "Asia/Almaty");
      await updateTask(tx, t.id, { status: "done" }, "Asia/Almaty"); // already done: must not duplicate
      const open = await listTasks(tx, { status: "open", limit: 50 });
      expect(open).toHaveLength(1);
      expect(open[0]!.dueAt).toBe("2026-11-17T18:59:00.000Z");
      expect(open[0]!.recurrence).toEqual({ freq: "weekly", interval: 1 });
    });
  });

  it("requires a due date for recurring tasks", async () => {
    const u = await createOnboardedUser("recur2");
    await withUser(u.userId, async (tx) => {
      await expect(createTask(tx, { title: "x", recurrence: { freq: "daily", interval: 1 } })).rejects.toMatchObject({ code: "validation" });
    });
  });
});

describe("notifications", () => {
  it("generates restrained, de-duplicated notifications and honours preferences", async () => {
    const u = await createOnboardedUser("notif");
    const now = new Date("2026-11-10T08:00:00Z");
    await withUser(u.userId, async (tx) => {
      const { id: courseId } = await createCourse(tx, { periodId: u.periodId, title: "Physics" });
      const soon = await createTask(tx, { title: "Due soon", dueAt: "2026-11-10T20:00:00Z" });
      await createTask(tx, { title: "Overdue A", dueAt: "2026-11-01T20:00:00Z" });
      await createTask(tx, { title: "Overdue B", dueAt: "2026-11-02T20:00:00Z" });
      await createTask(tx, { title: "Far away", dueAt: "2026-12-30T20:00:00Z" });
      await createTask(tx, { title: "Remind me", dueAt: "2026-11-30T20:00:00Z", remindAt: ["2026-11-10T07:00:00Z"] });
      await addAssessment(tx, courseId, { title: "Quiz 3", kind: "quiz", weightPercent: 10, dueAt: "2026-11-11T05:00:00Z" });

      await syncNotifications(tx, "Asia/Almaty", {}, now);
      await syncNotifications(tx, "Asia/Almaty", {}, now); // idempotent
      const list = await listNotifications(tx, "inbox");
      const titles = list.map((n) => n.title).sort();
      expect(titles).toEqual(["2 overdue tasks", "Coming up: Quiz 3", "Due soon: Due soon", "Reminder: Remind me"]);
      expect(list.filter((n) => n.category === "overdue")).toHaveLength(1); // one digest, not one per task
      expect(list.every((n) => n.href?.startsWith("/"))).toBe(true);
      expect(await unreadCount(tx)).toBe(4);

      const n = list[0]!;
      await applyNotificationAction(tx, n.id, { action: "read" });
      expect(await unreadCount(tx)).toBe(3);
      await applyNotificationAction(tx, n.id, { action: "snooze", snoozeHours: 2 });
      expect((await listNotifications(tx, "inbox")).map((x) => x.id)).not.toContain(n.id);
      expect((await listNotifications(tx, "snoozed")).map((x) => x.id)).toEqual([n.id]);
      await applyNotificationAction(tx, n.id, { action: "archive" });
      expect((await listNotifications(tx, "archived")).map((x) => x.id)).toEqual([n.id]);
      void soon;
    });

    const v = await createOnboardedUser("notif2");
    await withUser(v.userId, async (tx) => {
      await createTask(tx, { title: "Due soon", dueAt: "2026-11-10T20:00:00Z" });
      await createTask(tx, { title: "Overdue", dueAt: "2026-11-01T20:00:00Z" });
      await syncNotifications(tx, "UTC", { deadline: false, overdue: false }, now);
      expect(await listNotifications(tx, "inbox")).toHaveLength(0);
    });
  });
});

describe("timetable, search, dashboard", () => {
  it("derives today's classes from the weekly pattern and ignores deleted courses", async () => {
    const u = await createOnboardedUser("tt");
    await withUser(u.userId, async (tx) => {
      const { id } = await createCourse(tx, { periodId: u.periodId, title: "Calculus" });
      await createSession(tx, { courseId: id, weekday: 2, startsAt: "09:00", endsAt: "10:30", kind: "lecture", location: "C1.1" });
      expect((await sessionsOnDate(tx, "2026-11-10", u.periodId)).map((s) => s.startsAt)).toEqual(["09:00"]); // Tuesday
      expect(await sessionsOnDate(tx, "2026-11-11", u.periodId)).toHaveLength(0); // Wednesday
      await deleteCourse(tx, id);
      expect(await sessionsOnDate(tx, "2026-11-10", u.periodId)).toHaveLength(0);
    });
  });

  it("search treats LIKE wildcards literally and finds across entity types", async () => {
    const u = await createOnboardedUser("search");
    await withUser(u.userId, async (tx) => {
      const { id } = await createCourse(tx, { periodId: u.periodId, title: "100% Algorithms" });
      await createCourse(tx, { periodId: u.periodId, title: "Other" });
      await createTask(tx, { title: "Algorithms homework", courseId: id });
      expect((await searchAll(tx, "algo")).map((h) => h.type).sort()).toEqual(["course", "task"]);
      expect((await searchAll(tx, "%")).map((h) => h.title)).toEqual(["100% Algorithms"]);
      expect(await searchAll(tx, "_")).toHaveLength(0);
    });
  });

  it("dashboard aggregates only real saved data", async () => {
    const u = await createOnboardedUser("dash");
    const now = new Date("2026-11-10T08:00:00Z"); // Tuesday 13:00 in Almaty
    await withUser(u.userId, async (tx) => {
      const ctx = (await getAcademicContext(tx, "2026-11-10"))!;
      const empty = await loadDashboard(tx, ctx, "Asia/Almaty", now);
      expect(empty.sessions).toHaveLength(0);
      expect(empty.deadlines).toHaveLength(0);
      expect(empty.performance.cumulativeGpa.gpa).toBeNull(); // no invented numbers

      const { id } = await createCourse(tx, { periodId: u.periodId, title: "Calculus", credits: 6, color: "blue" });
      await updateCourse(tx, id, { pinned: true });
      await createSession(tx, { courseId: id, weekday: 2, startsAt: "09:00", endsAt: "10:30", kind: "lecture" });
      await addAssessment(tx, id, { title: "Quiz", kind: "quiz", weightPercent: 50, score: 96 });
      await addAssessment(tx, id, { title: "Final exam", kind: "final", weightPercent: 50, dueAt: "2026-11-25T05:00:00Z" });
      await createTask(tx, { title: "Homework", courseId: id, priority: 2, dueAt: "2026-11-12T10:00:00Z" });
      await createTask(tx, { title: "Urgent", priority: 3 });
      const d = await loadDashboard(tx, ctx, "Asia/Almaty", now);
      expect(d.sessions.map((s) => s.courseTitle)).toEqual(["Calculus"]);
      expect(d.exams.map((e) => e.title)).toEqual(["Final exam"]);
      expect(d.deadlines.map((x) => x.title)).toEqual(["Homework"]);
      expect(d.tasks.map((t) => t.title)).toEqual(["Urgent", "Homework"]);
      expect(d.courses.map((c) => c.title)).toEqual(["Calculus"]);
      expect(d.performance.periodGpa.gpa).toBe(4); // 96 % so far → A
    });
  });

  it("preferences normalise widget layout", async () => {
    const u = await createUser("prefs");
    await withUser(u.userId, async (tx) => {
      const p = await updatePreferences(tx, { dashboardWidgets: [{ id: "notes", visible: false }, { id: "bogus", visible: true }, { id: "today", visible: true }] });
      expect(p.dashboardWidgets.map((w) => w.id).slice(0, 2)).toEqual(["notes", "today"]);
      expect(p.dashboardWidgets.find((w) => w.id === "notes")!.visible).toBe(false);
      expect(p.dashboardWidgets.some((w) => w.id === "bogus")).toBe(false);
      expect((await getPreferences(tx)).dashboardWidgets.length).toBe(p.dashboardWidgets.length);
    });
  });
});

describe("requirements (user-configured rules)", () => {
  it("creates, lists, deletes, and is private to the owner", async () => {
    const { createRequirement, deleteRequirement, listRequirements } = await import("@/server/services/requirements");
    const a = await createOnboardedUser("reqA");
    const b = await createOnboardedUser("reqB");
    const rid = await withUser(a.userId, async (tx) => {
      const { id } = await createRequirement(tx, { name: "Avoid retake (handbook)", kind: "course_percent", threshold: 50, sourceNote: "Regulations p.12" });
      await createRequirement(tx, { name: "Scholarship GPA", kind: "period_gpa", threshold: 3.0, courseId: null });
      expect((await listRequirements(tx)).map((r) => [r.name, r.threshold, r.courseId])).toEqual([["Avoid retake (handbook)", 50, null], ["Scholarship GPA", 3, null]]);
      return id;
    });
    await withUser(b.userId, async (tx) => {
      expect(await listRequirements(tx)).toEqual([]);
      await expect(deleteRequirement(tx, rid)).rejects.toMatchObject({ code: "not_found" });
    });
    await withUser(a.userId, async (tx) => {
      await deleteRequirement(tx, rid);
      expect(await listRequirements(tx)).toHaveLength(1);
    });
  });

  it("scale policy defaults to unknown (nothing assumed) and can be configured", async () => {
    const u = await createOnboardedUser("policy");
    await withUser(u.userId, async (tx) => {
      let ctx = (await getAcademicContext(tx, "2026-11-10"))!;
      expect(ctx.scale.passPercent).toBeNull();
      expect(ctx.scale.minFinalPercent).toBeNull();
      await replaceScaleBands(tx, ctx.scale.id, ctx.scale.bands.map((b) => ({ ...b })), "none", { passPercent: 50, minFinalPercent: 30 });
      ctx = (await getAcademicContext(tx, "2026-11-10"))!;
      expect([ctx.scale.passPercent, ctx.scale.minFinalPercent]).toEqual([50, 30]);
    });
  });

  it("course lifecycle: archived courses leave pickers but keep their grades", async () => {
    const u = await createOnboardedUser("life");
    await withUser(u.userId, async (tx) => {
      const { id } = await createCourse(tx, { periodId: u.periodId, title: "Old course", credits: 4 });
      await addAssessment(tx, id, { title: "Final", kind: "final", weightPercent: 100, score: 90 });
      await updateCourse(tx, id, { status: "archived" });
      expect(await listCourses(tx)).toHaveLength(0);
      expect((await listCourses(tx, { status: "archived" })).map((c) => c.id)).toEqual([id]);
      const ctx = (await getAcademicContext(tx, "2026-11-10"))!;
      const book = await loadGradebook(tx, ctx.scale);
      expect(book.find((c) => c.id === id)!.grade.finalPercent).toBe(90); // history preserved
      await updateCourse(tx, id, { status: "completed" });
      expect(await listCourses(tx)).toHaveLength(1);
    });
  });
});
