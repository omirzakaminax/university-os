import { route, parse } from "@/server/api";
import { courseCreateSchema } from "@/server/schemas";
import { createCourse, getCourse, listCourses } from "@/server/services/courses";
import { z } from "zod";

export const GET = route(({ ctx, req }) => {
  const periodId = parse(z.object({ periodId: z.uuid().optional() }), Object.fromEntries(req.nextUrl.searchParams)).periodId;
  return listCourses(ctx.tx, { periodId });
});

export const POST = route(async ({ ctx, body }) => {
  const { id } = await createCourse(ctx.tx, parse(courseCreateSchema, body));
  return getCourse(ctx.tx, id);
}, { successStatus: 201 });
