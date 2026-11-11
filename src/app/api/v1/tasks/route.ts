import { route, parse } from "@/server/api";
import { taskCreateSchema, taskListQuerySchema } from "@/server/schemas";
import { createTask, listTasks } from "@/server/services/tasks";

export const GET = route(({ ctx, req }) => listTasks(ctx.tx, parse(taskListQuerySchema, Object.fromEntries(req.nextUrl.searchParams))));
export const POST = route(({ ctx, body }) => createTask(ctx.tx, parse(taskCreateSchema, body)), { successStatus: 201 });
