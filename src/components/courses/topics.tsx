"use client";

import { useState } from "react";
import { ListChecks, Plus, X } from "lucide-react";
import { Card, CardHeader, Progress } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { addTopicAction, deleteTopicAction, updateTopicAction } from "@/app/actions/data";
import type { Topic } from "@/server/services/courses";

const STATUS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "covered", label: "Covered" },
  { value: "mastered", label: "Mastered" },
];

export function Topics({ courseId, topics }: { courseId: string; topics: Topic[] }) {
  const [title, setTitle] = useState("");
  const { run, pending } = useAction();
  const covered = topics.filter((t) => t.status === "covered" || t.status === "mastered").length;
  return (
    <Card>
      <CardHeader title="Syllabus & topics" description={topics.length ? `${covered} of ${topics.length} covered` : "Track what has been taught"} />
      <div className="space-y-3 p-4">
        {topics.length > 0 && <Progress value={(covered / topics.length) * 100} label="Syllabus progress" />}
        {topics.length === 0 && (
          <p className="flex items-center gap-2 text-xs text-subtle"><ListChecks className="h-3.5 w-3.5" /> Add the topics from your syllabus to track progress through the course.</p>
        )}
        <ul className="space-y-1.5">
          {topics.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px]">{t.title}</span>
              <Select aria-label={`Status of ${t.title}`} className="h-7 w-28 text-xs" value={t.status} onChange={(e) => void run(() => updateTopicAction(t.id, { status: e.target.value }))}>
                {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Button variant="ghost" size="icon" aria-label={`Remove ${t.title}`} onClick={() => void run(() => deleteTopicAction(t.id))}><X className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => addTopicAction(courseId, { title })); if (r.ok) setTitle(""); }}>
          <Input aria-label="New topic" placeholder="Add a topic…" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" size="icon" aria-label="Add topic" loading={pending} disabled={!title.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
      </div>
    </Card>
  );
}
