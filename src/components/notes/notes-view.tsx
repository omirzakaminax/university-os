"use client";

import { useState } from "react";
import { NotebookPen, Pin, PinOff, Trash2 } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "@/app/actions/data";
import type { NoteRow } from "@/server/services/notes";

export function NotesView({ notes, courses }: { notes: NoteRow[]; courses: { id: string; title: string }[] }) {
  const [f, setF] = useState({ title: "", body: "", courseId: "" });
  const { run, pending, error } = useAction();
  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="h-fit p-4">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => createNoteAction({ title: f.title, body: f.body, courseId: f.courseId || null }), { success: "Note saved" }); if (r.ok) setF({ title: "", body: "", courseId: "" }); }}>
          <h2 className="text-[13px] font-semibold">New note</h2>
          <Field label="Title">{(p) => <Input {...p} maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
          <Field label="Note">{(p) => <Textarea {...p} rows={5} maxLength={50000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
          <Field label="Course">{(p) => <Select {...p} value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">No course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>}</Field>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" loading={pending} disabled={!f.title.trim() && !f.body.trim()}>Save note</Button>
        </form>
      </Card>
      <div className="space-y-2.5">
        {notes.length === 0 ? (
          <Card><EmptyState icon={<NotebookPen className="h-4 w-4" />} title="No notes yet" description="Capture ideas, lecture takeaways and reminders. Notes are private to you." /></Card>
        ) : (
          notes.map((n) => <NoteCard key={n.id} n={n} />)
        )}
      </div>
    </div>
  );
}

function NoteCard({ n }: { n: NoteRow }) {
  const { run } = useAction();
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {n.title && <h3 className="truncate text-sm font-semibold">{n.title}</h3>}
          <p className="mt-0.5 text-xs text-subtle">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(n.updatedAt))}{n.courseTitle && <> · <Badge>{n.courseTitle}</Badge></>}</p>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" aria-pressed={n.pinned} aria-label={n.pinned ? "Unpin note" : "Pin note"} onClick={() => void run(() => updateNoteAction(n.id, { pinned: !n.pinned }))}>{n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</Button>
          <Button variant="ghost" size="icon" aria-label="Delete note" onClick={() => { if (confirm("Delete this note?")) void run(() => deleteNoteAction(n.id), { success: "Note deleted" }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {n.body && <p className="mt-2 whitespace-pre-wrap break-words text-[13px] text-muted">{n.body}</p>}
    </Card>
  );
}
