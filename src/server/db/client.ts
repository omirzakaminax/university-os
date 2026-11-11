import postgres, { type Sql, type TransactionSql } from "postgres";
import { env } from "@/server/env";

export type Tx = TransactionSql<Record<string, unknown>>;

// Return numbers for NUMERIC, ISO strings for timestamptz, plain strings for DATE/TIME.
const types = {
  numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
  timestamptz: { to: 1184, from: [1184], serialize: (x: unknown) => (x instanceof Date ? x.toISOString() : String(x)), parse: (x: string) => new Date(x).toISOString() },
  date: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
  bigint: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
};

const globalForDb = globalThis as unknown as { __uosSql?: Sql; __uosAdminSql?: Sql };

function create(url: string, max: number): Sql {
  return postgres(url, { max, transform: postgres.camel, types, onnotice: () => {}, idle_timeout: 20, prepare: false });
}

/** Connection used for all user data. Connects as a role that does NOT bypass RLS. */
export function appSql(): Sql {
  return (globalForDb.__uosSql ??= create(env().DATABASE_URL, 10));
}

/** Privileged connection. Restricted to the local auth provider and account administration. */
export function adminSql(): Sql {
  const url = env().DATABASE_ADMIN_URL;
  if (!url) throw new Error("DATABASE_ADMIN_URL is required for the local auth provider");
  return (globalForDb.__uosAdminSql ??= create(url, 4));
}

/**
 * Run `fn` inside a transaction that is scoped to `userId` and subject to Row Level Security.
 *
 * It mirrors what PostgREST does for Supabase: set the JWT claims that `auth.uid()` reads and
 * switch to the `authenticated` role. Because the role switch is transaction-local, a pooled
 * connection can never leak one user's identity into another request.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>, sql: Sql = appSql()): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("withUser: invalid user id");
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true), set_config('role', 'authenticated', true)`;
    return fn(tx as unknown as Tx);
  }) as Promise<T>;
}
