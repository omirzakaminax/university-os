import { route, parse } from "@/server/api";
import { courseUpdateSchema, id } from "@/server/schemas";
import { deleteCourse, getCourse, listAssessments, listTopics, updateCourse } from "@/server/services/courses";

type P = { id: string };

export const GET = route<P>(async ({ ctx, params }) => {
  const courseId = parse(id, params.id);
  const [course, topics, assessments] = await Promise.all([getCourse(ctx.tx, courseId), listTopics(ctx.tx, courseId), listAssessments(ctx.tx, courseId)]);
  return { ...course, topics, assessments };
});

export const PATCH = route<P>(({ ctx, params, body }) => updateCourse(ctx.tx, parse(id, params.id), parse(courseUpdateSchema, body)));

export const DELETE = route<P>(async ({ ctx, params }) => {
  await deleteCourse(ctx.tx, parse(id, params.id));
  return { deleted: true };
});
