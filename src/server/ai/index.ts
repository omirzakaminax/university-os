import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import type { Tx } from "@/server/db/client";
import { createGeminiProvider } from "@/server/ai/gemini";
import type { JsonRequest, JsonResult, LlmProvider } from "@/server/ai/provider";

let override: LlmProvider | null | undefined;

/** Test hook: inject a provider (or `null` to force "not configured"). Never used in production code paths. */
export function setProviderForTests(p: LlmProvider | null | undefined) {
  override = p;
}

export function getProvider(): LlmProvider | null {
  if (override !== undefined) return override;
  const e = env();
  if (e.AI_PROVIDER === "none" || !e.GEMINI_API_KEY) return null;
  return createGeminiProvider({ apiKey: e.GEMINI_API_KEY, base: e.GEMINI_API_BASE, modelFast: e.GEMINI_MODEL_FAST, modelSmart: e.GEMINI_MODEL_SMART });
}

export async function hasConsent(tx: Tx): Promise<boolean> {
  const [r] = await tx<{ at: string | null }[]>`select ai_consent_at as at from user_preferences`;
  return !!r?.at;
}

/**
 * The only way application code talks to a model. Enforces, in order:
 *   1. a provider is configured (otherwise the caller should have used the non-AI path)
 *   2. the user has explicitly consented to sending their content to the provider
 *   3. the per-user daily request budget (AI_DAILY_REQUEST_LIMIT) is not exhausted
 * and records token usage afterwards. Cost is stored as NULL (unknown/free tier) rather than invented.
 */
export async function runJson(tx: Tx, req: JsonRequest): Promise<JsonResult & { provider: string }> {
  const provider = getProvider();
  if (!provider) throw new AppError("unavailable", "No AI provider is configured on this server.");
  if (!(await hasConsent(tx))) throw new AppError("forbidden", "Turn on AI assistance in Settings first. It sends the text of your documents to the AI provider.");
  const limit = env().AI_DAILY_REQUEST_LIMIT;
  const [used] = await tx<{ n: number }[]>`select count(*) as n from ai_usage where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`;
  if ((used?.n ?? 0) >= limit) throw new AppError("rate_limited", `You have reached today’s AI limit (${limit} requests). It resets at midnight UTC. Everything else still works without AI.`);
  const out = await provider.generateJson(req);
  await tx`insert into ai_usage (provider, model, task, input_tokens, output_tokens, est_cost_usd) values (${provider.id}, ${out.model}, ${req.task}, ${out.inputTokens}, ${out.outputTokens}, ${null})`;
  return { ...out, provider: provider.id };
}

export async function usageToday(tx: Tx): Promise<{ requests: number; inputTokens: number; outputTokens: number; limit: number }> {
  const [r] = await tx<{ n: number; i: number | null; o: number | null }[]>`
    select count(*) as n, sum(input_tokens) as i, sum(output_tokens) as o from ai_usage
    where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`;
  return { requests: r?.n ?? 0, inputTokens: Number(r?.i ?? 0), outputTokens: Number(r?.o ?? 0), limit: env().AI_DAILY_REQUEST_LIMIT };
}
