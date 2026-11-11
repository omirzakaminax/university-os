import { withUser } from "./helpers";
import { createCourse, addAssessment } from "@/server/services/courses";
import { createTask } from "@/server/services/tasks";
import { createNote } from "@/server/services/notes";
import { createSession } from "@/server/services/timetable";
import { syncNotifications } from "@/server/services/notifications";
import { audit } from "@/server/services/audit";

/** Give a user one of everything. Returns the ids so tests can target them from another account. */
export async function seedWorkspace(userId: string, periodId: string) {
  return withUser(userId, async (tx) => {
    const { id: courseId } = await createCourse(tx, { periodId, title: "Calculus I", code: "MATH101", credits: 6, instructorName: "Dr. Secret" });
    const assessment = await addAssessment(tx, courseId, { title: "Midterm", kind: "midterm", weightPercent: 40, score: 88, dueAt: "2026-10-01T10:00:00Z" });
    const task = await createTask(tx, { title: "Secret task", courseId, dueAt: new Date(Date.now() + 3 * 3600_000).toISOString(), remindAt: [new Date(Date.now() - 1000).toISOString()] });
    const note = await createNote(tx, { title: "Private diary", body: "do not read" });
    const session = await createSession(tx, { courseId, weekday: 2, startsAt: "09:00", endsAt: "10:30", kind: "lecture", location: "C1.2.3" });
    await syncNotifications(tx, "Asia/Almaty", {});
    await audit(tx, "test.seed", "course", courseId);
    return { courseId, assessmentId: assessment.id, taskId: task.id, noteId: note.id, sessionId: session.id };
  });
}
