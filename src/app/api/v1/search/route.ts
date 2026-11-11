import { route, parse } from "@/server/api";
import { searchQuerySchema } from "@/server/schemas";
import { searchAll } from "@/server/services/search";

export const GET = route(({ ctx, req }) => searchAll(ctx.tx, parse(searchQuerySchema, Object.fromEntries(req.nextUrl.searchParams)).q));
