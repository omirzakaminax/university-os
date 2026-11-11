import type { Tx } from "@/server/db/client";
import { notFound, validation } from "@/server/errors";
import { definedEntries, setClause } from "@/server/db/patch";
import type { z } from "zod";
import type { noteSchema, noteUpdateSchema } from "@/server/schemas";

export interface NoteRow { id: string; courseId: string | null; courseTitle: string | null; title: string; body: string; pinned: boolean; createdAt: string; updatedAt: string }

const cols = (tx: Tx) => tx`n.id, n.course_id, c.title as course_title, n.title, n.body, n.pinned, n.created_at, n.updated_at`;

export async function listNotes(tx: Tx, limit = 100): Promise<NoteRow[]> {
  return tx<NoteRow[]>`select ${cols(tx)} from notes n left join courses c on c.id = n.course_id where n.deleted_at is null order by n.pinned desc, n.updated_at desc limit ${limit}`;
}

export async function createNote(tx: Tx, input: z.infer<typeof noteSchema>) {
  const values = definedEntries({ title: input.title ?? undefined, body: input.body, courseId: input.courseId, pinned: input.pinned });
  const [row] = await tx<{ id: string }[]>`insert into notes ${tx(values as Record<string, never>)} returning id`;
  const [note] = await tx<NoteRow[]>`select ${cols(tx)} from notes n left join courses c on c.id = n.course_id where n.id = ${row!.id}`;
  return note!;
}

export async function updateNote(tx: Tx, noteId: string, input: z.infer<typeof noteUpdateSchema>) {
  const patch: Record<string, unknown> = { ...input };
  if (input.title === null) patch.title = "";
  const set = setClause(tx, patch);
  if (!set) throw validation("Nothing to update");
  const rows = await tx`update notes set ${set} where id = ${noteId} and deleted_at is null returning id`;
  if (rows.length === 0) throw notFound("Note");
}

export async function deleteNote(tx: Tx, noteId: string) {
  const rows = await tx`update notes set deleted_at = now() where id = ${noteId} and deleted_at is null returning id`;
  if (rows.length === 0) throw notFound("Note");
}
