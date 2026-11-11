import { route, parse } from "@/server/api";
import { assessmentCreateSchema, id } from "@/server/schemas";
import { addAssessment } from "@/server/services/courses";

export const POST = route<{ id: string }>(({ ctx, params, body }) => addAssessment(ctx.tx, parse(id, params.id), parse(assessmentCreateSchema, body)), { successStatus: 201 });
