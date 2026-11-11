import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { SyllabusUploader } from "@/components/syllabus/uploader";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { aiStatus } from "@/server/env";
import { hasConsent } from "@/server/ai";
import { listImports } from "@/server/services/syllabus";

export const metadata: Metadata = { title: "Import syllabus" };

export default async function ImportPage() {
  const app = await getAppContext();
  const { drafts, consented } = await withUser(app.userId, async (tx) => ({ drafts: await listImports(tx, "draft"), consented: await hasConsent(tx) }));
  const ai = aiStatus();
  return (
    <>
      <Link href="/courses" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ChevronLeft className="h-3.5 w-3.5" /> Courses</Link>
      <PageHeader title="Create a course from a syllabus" description="Upload the syllabus, review what was found, and only then create the course." />
      <div className="max-w-3xl space-y-4">
        <SyllabusUploader periods={app.academic.periods.filter((p) => !p.archivedAt).map((p) => ({ id: p.id, label: `${p.yearLabel} · ${p.name}` }))} activePeriodId={app.academic.activePeriod.id} ai={{ configured: ai.configured, consented, provider: ai.provider }} />
        {drafts.length > 0 && (
          <Card>
            <CardHeader title="Drafts waiting for review" description="Analysed but not yet approved — these are not courses." />
            <ul className="divide-y divide-line px-1 py-1.5">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link href={`/courses/import/${d.id}`} className="flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-hover">
                    <FileText className="h-4 w-4 text-subtle" />
                    <span className="min-w-0 flex-1 truncate">{d.extracted.title ?? d.documentTitle}</span>
                    <span className="text-xs text-subtle">{d.method === "ai" ? "AI" : "rules"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
