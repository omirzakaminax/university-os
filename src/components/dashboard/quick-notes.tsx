"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { createNoteAction } from "@/app/actions/data";

export function QuickNotes({ notes }: { notes: { id: string; title: string; body: string }[] }) {
  const [text, setText] = useState("");
  const { run, pending } = useAction();
  return (
    <div className="space-y-2 p-3">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => createNoteAction({ body: text }), { success: "Note saved" });
          if (r.ok) setText("");
        }}
      >
        <Input aria-label="New quick note" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jot something down…" maxLength={2000} />
        <Button type="submit" variant="secondary" size="icon" aria-label="Save note" loading={pending} disabled={!text.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      {notes.length === 0 ? (
        <p className="px-1 py-3 text-xs text-subtle">No notes yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[13px]">
              {n.title && <p className="truncate font-medium">{n.title}</p>}
              <p className="line-clamp-2 text-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
