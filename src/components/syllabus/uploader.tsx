"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileText, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/card";
import { useAction } from "@/components/ui/use-action";
import { useToast } from "@/components/ui/toast";
import { analyzeSyllabusAction } from "@/app/actions/data";
import { cn } from "@/lib/cn";

export interface AiState { configured: boolean; consented: boolean; provider: string | null }

export function SyllabusUploader({ periods, activePeriodId, ai }: { periods: { id: string; label: string }[]; activePeriodId: string; ai: AiState }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState(activePeriodId);
  const [useAi, setUseAi] = useState(false);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = useAction();
  const aiUsable = ai.configured && ai.consented;

  async function submit() {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", "syllabus");
      const res = await fetch("/api/v1/documents", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Upload failed.");
        return;
      }
      const documentId = json.data.document.id as string;
      const r = await run(() => analyzeSyllabusAction({ documentId, periodId: period, useAi: useAi && aiUsable }));
      if (r.ok) {
        toast.success(json.data.duplicate ? "This file was already uploaded — reopened its analysis." : "Syllabus analysed. Review it before saving.");
        router.push(`/courses/import/${(r.data as { id: string }).id}`);
      }
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files?.[0] ?? null); }}
        className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors", drag ? "border-accent bg-accent-soft" : "border-line-strong bg-surface")}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-raised text-muted">{file ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</div>
        {file ? (
          <p className="text-[13px] font-medium" data-testid="chosen-file">{file.name} <span className="text-subtle">· {(file.size / 1024).toFixed(0)} KB</span></p>
        ) : (
          <p className="text-[13px] text-muted">Drop your syllabus here, or choose a file</p>
        )}
        <p className="text-xs text-subtle">PDF, DOCX, TXT or Markdown · up to 15 MB. Scanned images need AI/OCR (see below).</p>
        <input ref={input} type="file" aria-label="Syllabus file" accept=".pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button onClick={() => input.current?.click()}>{file ? "Choose a different file" : "Choose file"}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Add the course to" hint="You can change this during review.">
          {(p) => <Select {...p} value={period} onChange={(e) => setPeriod(e.target.value)}>{periods.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>}
        </Field>
        <div className="space-y-1.5">
          <p className="block text-xs font-medium text-muted">How to analyse</p>
          <label className={cn("flex items-start gap-2.5 rounded-lg border border-line bg-surface p-3 text-[13px]", !aiUsable && "opacity-70")}>
            <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={useAi && aiUsable} disabled={!aiUsable} onChange={(e) => setUseAi(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 font-medium"><Sparkles className="h-3.5 w-3.5 text-accent-text" /> Use AI assistance {ai.provider && <Badge>{ai.provider}</Badge>}</span>
              <span className="mt-0.5 block text-xs text-subtle">
                {!ai.configured ? "No AI provider is configured on this server, so the free rules-based analysis is used." : !ai.consented ? "Enable AI assistance in Settings first (it sends the document text to the provider)." : "Sends the document text to the AI provider. Results are checked against your document."}
              </span>
            </span>
          </label>
        </div>
      </div>
      <FormError message={error} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-subtle">Nothing becomes a course until you review and approve it.</p>
        <Button variant="primary" size="lg" disabled={!file} loading={uploading || pending} onClick={submit}>Analyse syllabus</Button>
      </div>
    </div>
  );
}
