import { route, parse } from "@/server/api";
import { assessmentUpdateSchema, id } from "@/server/schemas";
import { deleteAssessment, updateAssessment } from "@/server/services/courses";

type P = { id: string };

export const PATCH = route<P>(({ ctx, params, body }) => updateAssessment(ctx.tx, parse(id, params.id), parse(assessmentUpdateSchema, body)));

export const DELETE = route<P>(async ({ ctx, params }) => {
  await deleteAssessment(ctx.tx, parse(id, params.id));
  return { deleted: true };
});
