"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action, parse, type ActionResult } from "@/server/runtime";
import * as S from "@/server/schemas";
import * as profile from "@/server/services/profile";
import * as academics from "@/server/services/academics";
import * as courses from "@/server/services/courses";
import * as tasks from "@/server/services/tasks";
import * as notes from "@/server/services/notes";
import * as timetable from "@/server/services/timetable";
import * as notifications from "@/server/services/notifications";
import * as documents from "@/server/services/documents";
import * as syllabus from "@/server/services/syllabus";
import * as requirements from "@/server/services/requirements";

const refresh = () => revalidatePath("/", "layout");

/** Run, then refresh server-rendered data on success. */
async function mutate<T>(fn: Parameters<typeof action<T>>[0]): Promise<ActionResult<T>> {
  const r = await action(fn);
  if (r.ok) refresh();
  return r;
}

// ---- Onboarding & settings ----------------------------------------------------------------------
export async function completeOnboardingAction(input: unknown) {
  return mutate(({ tx }) => profile.completeOnboarding(tx, parse(S.onboardingSchema, input)));
}
export async function updateProfileAction(input: unknown) {
  return mutate(({ tx }) => profile.updateProfile(tx, parse(S.profileUpdateSchema, input)));
}
export async function updatePreferencesAction(input: unknown) {
  return mutate(({ tx }) => profile.updatePreferences(tx, parse(S.preferencesUpdateSchema, input)));
}
export async function replaceScaleAction(input: unknown) {
  const data = parse(z.object({ scaleId: S.id, rounding: z.enum(["none", "half_up"]), bands: z.array(S.bandSchema).min(1).max(30), passPercent: z.number().min(0).max(100).nullable(), minFinalPercent: z.number().min(0).max(100).nullable() }), input);
  return mutate(({ tx }) => academics.replaceScaleBands(tx, data.scaleId, data.bands, data.rounding, { passPercent: data.passPercent, minFinalPercent: data.minFinalPercent }));
}
export async function createYearAction(input: unknown) {
  return mutate(({ tx }) => academics.createYear(tx, parse(S.yearCreateSchema, input)));
}
export async function createPeriodAction(input: unknown) {
  return mutate(({ tx }) => academics.createPeriod(tx, parse(S.periodCreateSchema, input)));
}
export async function setActivePeriodAction(periodId: string) {
  return mutate(({ tx }) => academics.setActivePeriod(tx, parse(S.id, periodId)));
}
export async function setPeriodArchivedAction(input: unknown) {
  const d = parse(z.object({ periodId: S.id, archived: z.boolean() }), input);
  return mutate(({ tx }) => academics.setPeriodArchived(tx, d.periodId, d.archived));
}

// ---- Courses ------------------------------------------------------------------------------------
export async function createCourseAction(input: unknown) {
  return mutate(({ tx }) => courses.createCourse(tx, parse(S.courseCreateSchema, input)));
}
export async function updateCourseAction(courseId: string, input: unknown) {
  return mutate(({ tx }) => courses.updateCourse(tx, parse(S.id, courseId), parse(S.courseUpdateSchema, input)));
}
export async function deleteCourseAction(courseId: string) {
  return mutate(({ tx }) => courses.deleteCourse(tx, parse(S.id, courseId)));
}
export async function addTopicAction(courseId: string, input: unknown) {
  return mutate(({ tx }) => courses.addTopic(tx, parse(S.id, courseId), parse(S.topicCreateSchema, input)));
}
export async function updateTopicAction(topicId: string, input: unknown) {
  return mutate(({ tx }) => courses.updateTopic(tx, parse(S.id, topicId), parse(S.topicUpdateSchema, input)));
}
export async function deleteTopicAction(topicId: string) {
  return mutate(({ tx }) => courses.deleteTopic(tx, parse(S.id, topicId)));
}

// ---- Assessments & grades -------------------------------------------------------------------------
export async function addAssessmentAction(courseId: string, input: unknown) {
  return mutate(({ tx }) => courses.addAssessment(tx, parse(S.id, courseId), parse(S.assessmentCreateSchema, input)));
}
export async function updateAssessmentAction(assessmentId: string, input: unknown) {
  return mutate(({ tx }) => courses.updateAssessment(tx, parse(S.id, assessmentId), parse(S.assessmentUpdateSchema, input)));
}
export async function deleteAssessmentAction(assessmentId: string) {
  return mutate(({ tx }) => courses.deleteAssessment(tx, parse(S.id, assessmentId)));
}

// ---- Tasks --------------------------------------------------------------------------------------
export async function createTaskAction(input: unknown) {
  return mutate(({ tx }) => tasks.createTask(tx, parse(S.taskCreateSchema, input)));
}
export async function updateTaskAction(taskId: string, input: unknown) {
  return mutate(async ({ tx, timezone }) => tasks.updateTask(tx, parse(S.id, taskId), parse(S.taskUpdateSchema, input), await timezone()));
}
export async function deleteTaskAction(taskId: string) {
  return mutate(({ tx }) => tasks.deleteTask(tx, parse(S.id, taskId)));
}

// ---- Notes --------------------------------------------------------------------------------------
export async function createNoteAction(input: unknown) {
  return mutate(({ tx }) => notes.createNote(tx, parse(S.noteSchema, input)));
}
export async function updateNoteAction(noteId: string, input: unknown) {
  return mutate(({ tx }) => notes.updateNote(tx, parse(S.id, noteId), parse(S.noteUpdateSchema, input)));
}
export async function deleteNoteAction(noteId: string) {
  return mutate(({ tx }) => notes.deleteNote(tx, parse(S.id, noteId)));
}

// ---- Timetable ----------------------------------------------------------------------------------
export async function createClassSessionAction(input: unknown) {
  return mutate(({ tx }) => timetable.createSession(tx, parse(S.classSessionSchema, input)));
}
export async function deleteClassSessionAction(sessionId: string) {
  return mutate(({ tx }) => timetable.deleteSession(tx, parse(S.id, sessionId)));
}

// ---- Notifications ------------------------------------------------------------------------------
export async function notificationAction(notificationId: string, input: unknown) {
  return mutate(({ tx }) => notifications.applyNotificationAction(tx, parse(S.id, notificationId), parse(S.notificationActionSchema, input)));
}
export async function markAllNotificationsReadAction() {
  return mutate(({ tx }) => notifications.markAllRead(tx));
}

// ---- Search (used by the command palette) --------------------------------------------------------
export async function searchAction(q: string) {
  const { searchAll } = await import("@/server/services/search");
  return action(({ tx }) => searchAll(tx, parse(S.searchQuerySchema, { q }).q));
}

// ---- Documents & syllabus import ------------------------------------------------------------------
export async function analyzeSyllabusAction(input: unknown) {
  const d = parse(z.object({ documentId: S.id, periodId: S.id.nullish(), useAi: z.boolean() }), input);
  return mutate(({ tx }) => syllabus.analyzeSyllabus(tx, d));
}
export async function approveSyllabusAction(importId: string, input: unknown) {
  return mutate(({ tx }) => syllabus.approveImport(tx, parse(S.id, importId), parse(syllabus.approveSchema, input)));
}
export async function discardSyllabusAction(importId: string) {
  return mutate(({ tx }) => syllabus.discardImport(tx, parse(S.id, importId)));
}
export async function deleteDocumentAction(documentId: string) {
  return mutate(({ tx }) => documents.deleteDocument(tx, parse(S.id, documentId)));
}
export async function searchMaterialsAction(input: unknown) {
  const d = parse(z.object({ q: z.string().trim().min(2).max(200), courseId: S.id.optional() }), input);
  return action(({ tx }) => documents.searchMaterials(tx, d.q, { courseId: d.courseId }));
}
export async function setAiConsentAction(consent: boolean) {
  return mutate(async ({ tx }) => {
    await tx`update user_preferences set ai_consent_at = ${consent ? new Date().toISOString() : null}`;
    const { audit } = await import("@/server/services/audit");
    await audit(tx, consent ? "ai.consent_granted" : "ai.consent_revoked");
  });
}

// ---- Grade requirements -----------------------------------------------------------------------------
export async function createRequirementAction(input: unknown) {
  return mutate(({ tx }) => requirements.createRequirement(tx, parse(requirements.requirementSchema, input)));
}
export async function deleteRequirementAction(requirementId: string) {
  return mutate(({ tx }) => requirements.deleteRequirement(tx, parse(S.id, requirementId)));
}
