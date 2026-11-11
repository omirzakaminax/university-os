import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /** Privileged connection. Only used by the LOCAL auth provider and migrations — never by Supabase mode. */
  DATABASE_ADMIN_URL: z.string().optional(),
  AUTH_PROVIDER: z.enum(["local"]).default("local"),
  AUTH_DEV_SHOW_RESET_LINK: z.enum(["0", "1"]).default("0"),
  APP_URL: z.string().url().optional(),
  /** AI is optional. Only Gemini has an adapter today (see src/server/ai). */
  AI_PROVIDER: z.enum(["gemini", "none"]).optional(),
  GEMINI_API_KEY: z.string().optional(),
  /** Model ids are configuration, not code: provider catalogues change. Verify against the provider's current docs. */
  GEMINI_MODEL_FAST: z.string().default("gemini-2.5-flash"),
  GEMINI_MODEL_SMART: z.string().optional(),
  GEMINI_API_BASE: z.string().url().default("https://generativelanguage.googleapis.com"),
  AI_DAILY_REQUEST_LIMIT: z.coerce.number().int().min(0).max(10_000).default(30),
  NODE_ENV: z.string().default("development"),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

/** Parsed lazily so `next build` does not require runtime secrets. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error("Invalid environment: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    cached = parsed.data;
  }
  return cached;
}

/** AI provider status is a configuration fact, surfaced honestly in the UI. */
export function aiStatus(): { configured: boolean; provider: string | null } {
  const e = env();
  if (e.AI_PROVIDER !== "none" && e.GEMINI_API_KEY) return { configured: true, provider: "gemini" };
  return { configured: false, provider: null };
}
