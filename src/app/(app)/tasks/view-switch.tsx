"use client";

import Link from "next/link";
import { LayoutList, Columns3 } from "lucide-react";
import { cn } from "@/lib/cn";

export function ViewSwitch({ view, status, courseId }: { view: string; status: string; courseId?: string }) {
  const href = (v: string) => `/tasks?view=${v}&status=${status}${courseId ? `&course=${courseId}` : ""}`;
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {[{ id: "list", icon: LayoutList, label: "List" }, { id: "board", icon: Columns3, label: "Board" }].map((v) => (
        <Link key={v.id} href={href(v.id)} aria-current={view === v.id ? "page" : undefined} className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs", view === v.id ? "bg-raised text-fg" : "text-subtle hover:text-fg")}>
          <v.icon className="h-3.5 w-3.5" aria-hidden />{v.label}
        </Link>
      ))}
    </div>
  );
}
