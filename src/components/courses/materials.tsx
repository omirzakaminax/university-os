"use client";

import { useRef, useState } from "react";
import { Download, FileText, Search, Trash2, Upload } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { deleteDocumentAction, searchMaterialsAction } from "@/app/actions/data";
import type { Citation, DocumentRow } from "@/server/services/documents";

const KINDS = [
  { value: "lecture", label: "Lecture slides / notes" },
  { value: "textbook", label: "Textbook" },
  { value: "assignment", label: "Assignment instructions" },
  { value: "syllabus", label: "Syllabus" },
  { value: "other", label: "Other" },
];

const STATUS_TONE = { ready: "success", processing: "neutral", needs_ocr: "warning", failed: "danger" } as const;
const STATUS_LABEL = { ready: "Searchable", processing: "Processing", needs_ocr: "No text (needs OCR)", failed: "Unreadable" } as const;

export function Materials({ courseId, documents }: { courseId: string; documents: DocumentRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("lecture");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Citation[] | null>(null);
  const { run, pending } = useAction();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("kind", kind);
        fd.set("courseId", courseId);
        const res = await fetch("/api/v1/documents", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setError(`${file.name}: ${json.error?.message ?? "Upload failed."}`);
          continue;
        }
        toast.success(json.data.duplicate ? `${file.name} was already in this course.` : `${file.name} uploaded.`);
      }
      router.refresh();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const r = await run(() => searchMaterialsAction({ q, courseId }));
    if (r.ok) setHits(r.data as Citation[]);
  }

  return (
    <Card>
      <CardHeader title="Materials" description="Lecture slides, textbooks and assignment sheets. Search them with page citations." />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Material type" className="w-48" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select>
          <input ref={fileInput} type="file" multiple aria-label="Upload materials" className="sr-only" accept=".pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg" onChange={(e) => void upload(e.target.files)} />
          <Button onClick={() => fileInput.current?.click()} loading={uploading}><Upload className="h-3.5 w-3.5" /> Upload files</Button>
          <span className="text-xs text-subtle">PDF, DOCX, TXT, MD · 15 MB max</span>
        </div>
        <FormError message={error} />

        {documents.length === 0 ? (
          <EmptyState icon={<FileText className="h-4 w-4" />} title="No materials yet" description="Upload lecture slides or notes to make them searchable here." />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{d.title}</p>
                  <p className="truncate text-xs text-subtle">{d.kind} · {(d.sizeBytes / 1024).toFixed(0)} KB{d.pageCount ? ` · ${d.pageCount} pages` : ""}{d.statusDetail ? ` · ${d.statusDetail}` : ""}</p>
                </div>
                <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                <a href={`/api/v1/documents/${d.id}/file`} download aria-label={`Download ${d.title}`}><Button variant="ghost" size="icon" tabIndex={-1}><Download className="h-3.5 w-3.5" /></Button></a>
                <Button variant="ghost" size="icon" aria-label={`Delete ${d.title}`} onClick={() => { if (confirm(`Delete “${d.title}”? The file and its search index are removed.`)) void run(() => deleteDocumentAction(d.id), { success: "Material deleted", refresh: true }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </li>
            ))}
          </ul>
        )}

        {documents.some((d) => d.status === "ready") && (
          <div className="space-y-2.5">
            <form onSubmit={search} className="flex gap-2">
              <Input aria-label="Search this course's materials" placeholder="Search your materials…" value={q} onChange={(e) => setQ(e.target.value)} minLength={2} />
              <Button type="submit" loading={pending} disabled={q.trim().length < 2}><Search className="h-3.5 w-3.5" /> Search</Button>
            </form>
            {hits && (
              <ul className="space-y-2" aria-live="polite" data-testid="material-hits">
                {hits.length === 0 && <li className="text-xs text-subtle">No matches in this course’s materials.</li>}
                {hits.map((h) => (
                  <li key={h.chunkId} className="rounded-lg border border-line bg-bg p-2.5 text-[13px]">
                    <p className="text-xs font-medium text-accent-text">{h.documentTitle}{h.page ? ` · page ${h.page}` : ""}</p>
                    <p className="mt-0.5 text-muted">{h.snippet.split(/(«[^»]*»)/).map((part, i) => (part.startsWith("«") ? <mark key={i} className="rounded bg-accent-soft px-0.5 text-fg">{part.slice(1, -1)}</mark> : <span key={i}>{part}</span>))}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
