import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { SyllabusReview } from "@/components/syllabus/review";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { getImport } from "@/server/services/syllabus";
import { z } from "zod";

export const metadata: Metadata = { title: "Review syllabus" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const app = await getAppContext();
  const imp = await withUser(app.userId, (tx) => getImport(tx, id)).catch((e) => {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  });
  return (
    <>
      <Link href="/courses/import" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ChevronLeft className="h-3.5 w-3.5" /> Import</Link>
      <PageHeader title="Review before saving" description="Correct anything that is wrong. Only what you approve is saved." />
      <div className="max-w-3xl">
        <SyllabusReview imp={imp} periods={app.academic.periods.filter((p) => !p.archivedAt).map((p) => ({ id: p.id, label: `${p.yearLabel} · ${p.name}` }))} defaultPeriodId={app.academic.activePeriod.id} tz={app.profile.timezone} />
      </div>
    </>
  );
}
