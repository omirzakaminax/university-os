import { route, parse } from "@/server/api";
import { id, taskUpdateSchema } from "@/server/schemas";
import { deleteTask, getTask, updateTask } from "@/server/services/tasks";

type P = { id: string };

export const GET = route<P>(({ ctx, params }) => getTask(ctx.tx, parse(id, params.id)));
export const PATCH = route<P>(async ({ ctx, params, body }) => updateTask(ctx.tx, parse(id, params.id), parse(taskUpdateSchema, body), await ctx.timezone()));
export const DELETE = route<P>(async ({ ctx, params }) => {
  await deleteTask(ctx.tx, parse(id, params.id));
  return { deleted: true };
});
