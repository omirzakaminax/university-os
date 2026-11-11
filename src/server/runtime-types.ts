/** Shared (client-safe) result type for server actions. */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
