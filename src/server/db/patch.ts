import type { Tx } from "@/server/db/client";

/** Keep only keys whose value is not undefined (so PATCH semantics are explicit: null clears, undefined leaves). */
export function definedEntries<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Build an `update ... set` fragment with the defined subset of `patch`, or null if there is nothing to update. */
export function setClause(tx: Tx, patch: Record<string, unknown>) {
  const clean = definedEntries(patch);
  const keys = Object.keys(clean);
  if (keys.length === 0) return null;
  return tx(clean as Record<string, never>, ...keys);
}
