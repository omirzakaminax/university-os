import "server-only";
import type { z } from "zod";
import { withUser, type Tx } from "@/server/db/client";
import type { ActionResult } from "@/server/runtime-types";
import { AppError, normalizeError, validation } from "@/server/errors";
import { requireSession } from "@/server/auth/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { getProfile } from "@/server/services/profile";



export type { ActionResult };

export interface UserCtx {
  tx: Tx;
  userId: string;
  email: string;
  /** The user's IANA timezone (loaded on first use). */
  timezone: () => Promise<string>;
}

/** Validate untrusted input against a zod schema; throws a ValidationError carrying per-field messages. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  throw validation(Object.values(fieldErrors)[0] ?? "Invalid input", fieldErrors);
}

/** Run `fn` as the signed-in user inside an RLS-scoped transaction. */
export async function runAsUser<T>(fn: (ctx: UserCtx) => Promise<T>): Promise<T> {
  const session = await requireSession();
  enforceRateLimit(`user:${session.userId}`, 600, 60_000);
  return withUser(session.userId, async (tx) => {
    let tz: string | undefined;
    return fn({
      tx,
      userId: session.userId,
      email: session.email,
      timezone: async () => (tz ??= (await getProfile(tx)).timezone),
    });
  });
}

/** Server-action wrapper: never throws to the client, never leaks internals. */
export async function action<T>(fn: (ctx: UserCtx) => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await runAsUser(fn) };
  } catch (e) {
    // Next's redirect()/notFound() signals must propagate.
    if (typeof e === "object" && e && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    const err = normalizeError(e);
    return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
  }
}

export { AppError };
