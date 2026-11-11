import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardHeader, CourseDot, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GradePanel } from "@/components/courses/grade-panel";
import { Assessments } from "@/components/courses/assessments";
import { Topics } from "@/components/courses/topics";
import { Materials } from "@/components/courses/materials";
import { listDocuments } from "@/server/services/documents";
import { listRequirements } from "@/server/services/requirements";
import { policyRequirements } from "@/domain/grades/requirements";
import { CourseActions } from "@/components/courses/course-actions";
import { NewTaskButton, TaskList } from "@/components/tasks/task-list";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { getCourse, listAssessments, listTopics } from "@/server/services/courses";
import { listTasks } from "@/server/services/tasks";
import { listSessions } from "@/server/services/timetable";
import { z } from "zod";

export const metadata: Metadata = { title: "Course" };
const WEEKDAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const app = await getAppContext();
  const data = await withUser(app.userId, async (tx) => {
    const course = await getCourse(tx, id);
    const [topics, assessments, tasks, sessions, documents, userReqs] = await Promise.all([listTopics(tx, id), listAssessments(tx, id), listTasks(tx, { status: "open", courseId: id, limit: 50 }), listSessions(tx), listDocuments(tx, { courseId: id }), listRequirements(tx)]);
    return { course, topics, assessments, tasks, documents, userReqs, sessions: sessions.filter((s) => s.courseId === id) };
  }).catch((e) => {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  });
  const { course, topics, assessments, tasks, sessions, documents, userReqs } = data;
  const extraTargets = [...policyRequirements({ passPercent: app.academic.scale.passPercent, minFinalPercent: app.academic.scale.minFinalPercent }), ...userReqs]
    .filter((r) => r.kind === "course_percent" && (!r.courseId || r.courseId === course.id))
    .map((r) => ({ label: r.name, percent: r.threshold }));
  const tz = app.profile.timezone;
  const courses = app.courses.map((c) => ({ id: c.id, title: c.title }));

  return (
    <>
      <Link href="/courses" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ChevronLeft className="h-3.5 w-3.5" /> Courses</Link>
      <PageHeader
        title={course.title}
        description={<span className="inline-flex flex-wrap items-center gap-x-2"><CourseDot color={course.color} />{[course.code, course.instructorName, `${course.credits} credits`, course.includeInGpa ? null : "Not in GPA", course.status === "active" ? null : course.status].filter(Boolean).join(" · ")}</span>}
        actions={<CourseActions periodId={course.periodId} course={{ id: course.id, title: course.title, code: course.code, description: course.description, credits: course.credits, color: course.color, includeInGpa: course.includeInGpa, targetPercent: course.targetPercent, instructorName: course.instructorName, pinned: course.pinned, status: course.status }} />}
      />
      {course.description && <p className="-mt-2 mb-5 max-w-2xl text-[13px] text-muted">{course.description}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <GradePanel assessments={assessments.map((a) => ({ id: a.id, title: a.title, weight: a.weightPercent, score: a.score, maxScore: a.maxScore }))} scale={{ bands: app.academic.scale.bands, rounding: app.academic.scale.rounding, maxPoints: app.academic.scale.maxPoints }} courseTargetPercent={course.targetPercent} credits={course.credits} extraTargets={extraTargets} />
          <Assessments courseId={course.id} assessments={assessments} tz={tz} />
          <Materials courseId={course.id} documents={documents} />
        </div>
        <div className="min-w-0 space-y-4">
          <Topics courseId={course.id} topics={topics} />
          <Card>
            <CardHeader title="Weekly schedule" action={<Link href="/timetable" className="text-xs text-muted hover:text-fg">Edit</Link>} />
            {sessions.length === 0 ? (
              <EmptyState title="No classes scheduled" description="Add this course's lectures and labs in the timetable." action={<Link href="/timetable"><Button size="sm">Open timetable</Button></Link>} />
            ) : (
              <ul className="divide-y divide-line px-1 py-1.5">
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                    <span className="w-9 text-xs font-medium text-muted">{WEEKDAYS[s.weekday]}</span>
                    <span className="font-mono text-xs">{s.startsAt}–{s.endsAt}</span>
                    <span className="ml-auto truncate text-xs text-subtle">{[s.kind, s.location].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Open tasks" action={<NewTaskButton tz={tz} courses={courses} defaultCourseId={course.id} label="Add" />} />
            <TaskList tasks={tasks} tz={tz} courses={courses} defaultCourseId={course.id} showCourse={false} emptyTitle="No open tasks" emptyDescription="Tasks linked to this course show up here." />
          </Card>
        </div>
      </div>
    </>
  );
}
