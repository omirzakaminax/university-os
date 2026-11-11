"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { updateTaskAction } from "@/app/actions/data";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export function TaskCheck({ id, done, title }: { id: string; done: boolean; title: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${done ? "Reopen" : "Complete"} ${title}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await updateTaskAction(id, { status: done ? "todo" : "done" });
          if (!r.ok) toast.error(r.error);
        })
      }
      className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors", done ? "border-accent bg-accent text-on-accent" : "border-line-strong hover:border-accent", pending && "opacity-50")}
    >
      {done && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}
