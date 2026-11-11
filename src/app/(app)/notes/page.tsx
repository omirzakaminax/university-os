import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { NotesView } from "@/components/notes/notes-view";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { listNotes } from "@/server/services/notes";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  const app = await getAppContext();
  const notes = await withUser(app.userId, (tx) => listNotes(tx));
  return (
    <>
      <PageHeader title="Notes" description="Private to your account. Link a note to a course to find it later." />
      <NotesView notes={notes} courses={app.courses.map((c) => ({ id: c.id, title: c.title }))} />
    </>
  );
}
