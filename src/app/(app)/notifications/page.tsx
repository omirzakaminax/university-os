import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { Inbox } from "@/components/notifications/inbox";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { listNotifications, NOTIFICATION_CATEGORIES, type NotificationCategory, type NotificationFilter } from "@/server/services/notifications";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Notifications" };

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "unread", label: "Unread" },
  { id: "snoozed", label: "Snoozed" },
  { id: "archived", label: "Archived" },
];

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ f?: string; c?: string }> }) {
  const sp = await searchParams;
  const app = await getAppContext();
  const filter = (FILTERS.find((f) => f.id === sp.f)?.id ?? "inbox") as NotificationFilter;
  const category = NOTIFICATION_CATEGORIES.find((c) => c.id === sp.c)?.id as NotificationCategory | undefined;
  const items = await withUser(app.userId, (tx) => listNotifications(tx, filter, category));
  const href = (f: string, c?: string) => `/notifications?f=${f}${c ? `&c=${c}` : ""}`;
  return (
    <>
      <PageHeader title="Notifications" description="Kept deliberately quiet. Choose what you hear about in Settings." actions={<Link href="/settings#notifications" className="text-xs text-muted hover:text-fg">Preferences</Link>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {FILTERS.map((f) => <Link key={f.id} href={href(f.id, category)} aria-current={filter === f.id ? "page" : undefined} className={cn("flex h-7 items-center rounded-md px-2.5 text-xs", filter === f.id ? "bg-raised text-fg" : "text-subtle hover:text-fg")}>{f.label}</Link>)}
        </div>
        <div className="flex gap-1.5">
          {NOTIFICATION_CATEGORIES.map((c) => <Link key={c.id} href={href(filter, category === c.id ? undefined : c.id)} aria-pressed={category === c.id} className={cn("rounded-md border px-2 py-1 text-xs", category === c.id ? "border-accent text-accent-text" : "border-line text-muted hover:text-fg")}>{c.label}</Link>)}
        </div>
      </div>
      <Inbox items={items} filter={filter} />
    </>
  );
}
