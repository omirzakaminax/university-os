"use client";

import Link from "next/link";
import { Archive, BellOff, Check, Circle } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";
import { markAllNotificationsReadAction, notificationAction } from "@/app/actions/data";
import { cn } from "@/lib/cn";
import type { NotificationRow } from "@/server/services/notifications";

const TONE = { deadline: "warning", reminder: "accent", overdue: "danger", academic: "neutral", system: "neutral" } as const;

export function Inbox({ items, filter }: { items: NotificationRow[]; filter: string }) {
  const { run } = useAction();
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <Card>
      {filter !== "archived" && unread > 0 && (
        <div className="flex justify-end border-b border-line px-3 py-2">
          <Button size="sm" variant="ghost" onClick={() => void run(() => markAllNotificationsReadAction(), { success: "All marked as read" })}><Check className="h-3.5 w-3.5" /> Mark all read</Button>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState icon={<BellOff className="h-4 w-4" />} title={filter === "archived" ? "Nothing archived" : filter === "snoozed" ? "Nothing snoozed" : "You're all caught up"} description="Deadline alerts, reminders and a daily overdue digest show up here — only when they matter." />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className={cn("group flex items-start gap-3 px-4 py-3", !n.readAt && "bg-accent-soft/40")}>
              <Circle className={cn("mt-1.5 h-2 w-2 shrink-0 fill-current", n.readAt ? "text-transparent" : "text-accent")} aria-label={n.readAt ? "Read" : "Unread"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {n.href ? (
                    <Link href={n.href} onClick={() => !n.readAt && void notificationAction(n.id, { action: "read" })} className="text-[13px] font-medium hover:text-accent-text">{n.title}</Link>
                  ) : (
                    <span className="text-[13px] font-medium">{n.title}</span>
                  )}
                  <Badge tone={TONE[n.category]} className="capitalize">{n.category}</Badge>
                </div>
                {n.body && <p className="mt-0.5 text-xs text-muted">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-subtle">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(n.createdAt))}{n.snoozedUntil && new Date(n.snoozedUntil) > new Date() ? ` · snoozed until ${new Intl.DateTimeFormat("en-GB", { timeStyle: "short", dateStyle: "short" }).format(new Date(n.snoozedUntil))}` : ""}</p>
              </div>
              <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                {n.readAt ? (
                  <Button variant="ghost" size="sm" onClick={() => void run(() => notificationAction(n.id, { action: "unread" }))}>Mark unread</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => void run(() => notificationAction(n.id, { action: "read" }))}>Mark read</Button>
                )}
                {filter !== "archived" && <Button variant="ghost" size="icon" aria-label={`Snooze ${n.title} for 3 hours`} title="Snooze 3 hours" onClick={() => void run(() => notificationAction(n.id, { action: "snooze", snoozeHours: 3 }), { success: "Snoozed for 3 hours" })}><BellOff className="h-3.5 w-3.5" /></Button>}
                {filter !== "archived" && <Button variant="ghost" size="icon" aria-label={`Archive ${n.title}`} title="Archive" onClick={() => void run(() => notificationAction(n.id, { action: "archive" }), { success: "Archived" })}><Archive className="h-3.5 w-3.5" /></Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
