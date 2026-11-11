/**
 * Minimal forward-only migration runner.
 *
 *   npm run db:migrate                 apply pending migrations
 *   npm run db:reset                   DROP and recreate the public/auth/local_auth schemas, then migrate
 *
 * Environment:
 *   DATABASE_ADMIN_URL   privileged connection (owner of the schema)
 *   LOCAL_SHIM=1         also apply db/local/*.sql (Supabase auth shim). Never set this for Supabase.
 *
 * Supabase users can instead run `supabase db push` — the SQL in supabase/migrations is the source of truth.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import "dotenv/config";
import { config as loadEnvLocal } from "dotenv";

loadEnvLocal({ path: ".env.local" });

const root = path.resolve(__dirname, "..");

export async function migrate(opts: { url: string; shim: boolean; reset: boolean; log?: (m: string) => void }) {
  const log = opts.log ?? ((m: string) => console.log(m));
  const sql = postgres(opts.url, { max: 1, onnotice: () => {} });
  try {
    if (opts.reset) {
      if (!opts.shim) throw new Error("--reset is only allowed together with LOCAL_SHIM=1 (never reset a Supabase project).");
      await sql.unsafe("drop schema if exists public cascade; drop schema if exists private cascade; drop schema if exists local_auth cascade; drop schema if exists auth cascade; create schema public;");
      await sql.unsafe("grant usage on schema public to anon, authenticated, service_role").catch(() => {});
      log("reset: dropped schemas");
    }
    if (opts.shim) {
      const dir = path.join(root, "db/local");
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
        await sql.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
        log(`shim: ${f}`);
      }
    }
    await sql.unsafe(`create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())`);
    await sql.unsafe(`revoke all on public.schema_migrations from anon, authenticated`).catch(() => {});
    const applied = new Set((await sql<{ version: string }[]>`select version from public.schema_migrations`).map((r) => r.version));
    const dir = path.join(root, "supabase/migrations");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      if (applied.has(f)) continue;
      await sql.begin(async (tx) => {
        await tx.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
        await tx`insert into public.schema_migrations (version) values (${f})`;
      });
      log(`applied: ${f}`);
    }
  } finally {
    await sql.end();
  }
}

if (require.main === module || process.argv[1]?.endsWith("migrate.ts")) {
  const url = process.env.DATABASE_ADMIN_URL;
  if (!url) {
    console.error("DATABASE_ADMIN_URL is not set");
    process.exit(1);
  }
  migrate({ url, shim: process.env.LOCAL_SHIM === "1", reset: process.argv.includes("--reset") })
    .then(() => console.log("done"))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
