import { AppError } from "@/server/errors";
import type { JsonRequest, JsonResult, LlmProvider } from "@/server/ai/provider";

export interface GeminiConfig {
  apiKey: string;
  base: string;
  modelFast: string;
  modelSmart?: string;
}

/**
 * Google Gemini over plain REST (no SDK dependency).
 *
 * STATUS: written from the commonly documented `generateContent` shape; NOT verified against Google's current
 * docs (they were unreachable from the build environment) and NOT run against the live API (no key available).
 * It is covered by tests against a local stub server only. Verify the endpoint, header and field names, plus the
 * model ids, with a real key before relying on it. The API key is sent server-side in a header, never to the browser.
 */
export function createGeminiProvider(cfg: GeminiConfig): LlmProvider {
  return {
    id: "gemini",
    async generateJson(req: JsonRequest): Promise<JsonResult> {
      const model = req.tier === "smart" ? (cfg.modelSmart ?? cfg.modelFast) : cfg.modelFast;
      const url = `${cfg.base.replace(/\/$/, "")}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: req.system }] },
            contents: [{ role: "user", parts: [{ text: req.user }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        throw new AppError("unavailable", "The AI provider could not be reached. Nothing was changed.");
      }
      if (res.status === 429) throw new AppError("rate_limited", "The AI provider’s quota is used up for now. Try again later, or continue without AI.");
      if (res.status === 401 || res.status === 403) throw new AppError("unavailable", "The AI provider rejected the server’s API key. Check the configuration.");
      if (!res.ok) throw new AppError("unavailable", `The AI provider returned an error (HTTP ${res.status}).`);
      const body = (await res.json().catch(() => null)) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      } | null;
      const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new AppError("unavailable", "The AI provider returned an empty answer.");
      return { text, model, inputTokens: body?.usageMetadata?.promptTokenCount ?? 0, outputTokens: body?.usageMetadata?.candidatesTokenCount ?? 0 };
    },
  };
}
