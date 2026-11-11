"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { deleteCourseAction, updateCourseAction } from "@/app/actions/data";
import { CourseDialog, type CourseFormValue } from "@/components/courses/course-form";

export function CourseActions({ course, periodId }: { course: CourseFormValue & { pinned: boolean; status: string }; periodId: string }) {
  const [edit, setEdit] = useState(false);
  const { run } = useAction();
  const router = useRouter();
  return (
    <>
      <Select aria-label="Course status" className="h-8 w-32" value={course.status} onChange={(e) => void run(() => updateCourseAction(course.id, { status: e.target.value }), { success: "Course status updated" })}>
        <option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option>
      </Select>
      <Button onClick={() => void run(() => updateCourseAction(course.id, { pinned: !course.pinned }), { success: course.pinned ? "Unpinned" : "Pinned to dashboard" })} aria-pressed={course.pinned}>
        {course.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} {course.pinned ? "Unpin" : "Pin"}
      </Button>
      <Button onClick={() => setEdit(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      <Button variant="danger" onClick={async () => { if (confirm(`Delete “${course.title}”? Its assessments, topics and classes will be removed from your views.`)) { const r = await run(() => deleteCourseAction(course.id), { success: "Course deleted" }); if (r.ok) router.push("/courses"); } }}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
      <CourseDialog open={edit} onOpenChange={setEdit} periodId={periodId} course={course} />
    </>
  );
}
