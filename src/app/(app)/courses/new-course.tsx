"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseDialog } from "@/components/courses/course-form";

export function NewCourseButton({ periodId, initiallyOpen = false, variant = "primary" }: { periodId: string; initiallyOpen?: boolean; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(initiallyOpen);
  const router = useRouter();
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> New course</Button>
      <CourseDialog open={open} onOpenChange={setOpen} periodId={periodId} onSaved={(id) => router.push(`/courses/${id}`)} />
    </>
  );
}
