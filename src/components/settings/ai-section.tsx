"use client";

import { Sparkles } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";
import { setAiConsentAction } from "@/app/actions/data";

export interface AiSettingsProps {
  configured: boolean;
  provider: string | null;
  consented: boolean;
  usage: { requests: number; inputTokens: number; outputTokens: number; limit: number };
}

export function AiSection({ configured, provider, consented, usage }: AiSettingsProps) {
  const { run, pending } = useAction();
  return (
    <Card id="ai">
      <CardHeader title="AI assistance" description="Optional. Everything core — courses, tasks, grades, GPA, schedules, searching your materials — works without it." action={<Badge tone={configured ? "success" : "neutral"}>{configured ? `${provider} configured` : "Not configured"}</Badge>} />
      <div className="space-y-4 p-4 text-[13px]">
        {!configured ? (
          <p className="text-muted">No AI provider is configured on this server. To enable one, the server administrator sets <code className="rounded bg-raised px-1 font-mono text-xs">GEMINI_API_KEY</code> (see docs/COSTS.md). Until then, syllabus analysis uses the free rules-based extractor.</p>
        ) : (
          <>
            <div className="rounded-lg border border-warning-border bg-warning-soft p-3 text-xs text-warning">
              <p className="font-medium">Before you turn this on</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>Enabling it sends the <strong>text of documents you choose to analyse</strong> to {provider}. Nothing is sent otherwise.</li>
                <li>Free tiers of some providers may use submitted content to improve their products (Google documents this for the Gemini free tier — check current terms). Don’t analyse documents you consider confidential unless your plan guarantees otherwise.</li>
                <li>AI output can be wrong. Syllabus results are checked against your document and always need your approval.</li>
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted">{consented ? "AI assistance is on for your account." : "AI assistance is off for your account."}</p>
              <Button variant={consented ? "secondary" : "primary"} loading={pending} onClick={() => void run(() => setAiConsentAction(!consented), { success: consented ? "AI assistance turned off" : "AI assistance turned on", refresh: true })}>
                <Sparkles className="h-3.5 w-3.5" /> {consented ? "Turn off" : "I understand — turn on"}
              </Button>
            </div>
            <p className="text-xs text-subtle">Today: {usage.requests} of {usage.limit} requests · {usage.inputTokens.toLocaleString()} tokens in / {usage.outputTokens.toLocaleString()} out. Cost is not estimated (free-tier pricing is unknown to this app).</p>
          </>
        )}
      </div>
    </Card>
  );
}
