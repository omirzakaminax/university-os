/**
 * Provider-independent LLM interface. Application code asks for a *task* at a *tier*; which vendor and model
 * answers is configuration. Adding a provider = implementing this interface (no feature code changes).
 *
 *   tier "fast"  → small/cheap model: classification, extraction, flashcard drafts
 *   tier "smart" → larger model: tutoring, multi-step analysis (falls back to fast when not configured)
 */
export type ModelTier = "fast" | "smart";

export interface JsonRequest {
  /** Stable task label used for usage accounting, e.g. "syllabus.extract". */
  task: string;
  tier: ModelTier;
  system: string;
  user: string;
}

export interface JsonResult {
  /** Raw model text (expected to be JSON; callers validate with zod). */
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmProvider {
  readonly id: string;
  generateJson(req: JsonRequest): Promise<JsonResult>;
}
