import type { Tx } from "@/server/db/client";
import { notFound } from "@/server/errors";
import { dateInTz } from "@/lib/time";
import type { z } from "zod";
import type { notificationActionSchema } from "@/server/schemas";

export type NotificationCategory = "deadline" | "reminder" | "overdue" | "academic" | "system";

export interface NotificationRow {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  archivedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
}

export { NOTIFICATION_CATEGORIES } from "@/server/services/notification-meta";

export type NotificationFilter = "inbox" | "unread" | "snoozed" | "archived";

export async function listNotifications(tx: Tx, filter: NotificationFilter, category?: NotificationCategory, limit = 100): Promise<NotificationRow[]> {
  const where =
    filter === "archived"
      ? tx`archived_at is not null`
      : filter === "snoozed"
        ? tx`archived_at is null and snoozed_until > now()`
        : filter === "unread"
          ? tx`archived_at is null and read_at is null and (snoozed_until is null or snoozed_until <= now())`
          : tx`archived_at is null and (snoozed_until is null or snoozed_until <= now())`;
  return tx<NotificationRow[]>`
    select id, category, title, body, href, read_at, archived_at, snoozed_until, created_at from notifications
    where ${where} ${category ? tx`and category = ${category}` : tx``} order by created_at desc limit ${limit}`;
}

export async function unreadCount(tx: Tx): Promise<number> {
  const [r] = await tx<{ n: number }[]>`select count(*) as n from notifications where archived_at is null and read_at is null and (snoozed_until is null or snoozed_until <= now())`;
  return r?.n ?? 0;
}

export async function applyNotificationAction(tx: Tx, id: string, input: z.infer<typeof notificationActionSchema>) {
  const rows =
    input.action === "read"
      ? await tx`update notifications set read_at = coalesce(read_at, now()) where id = ${id} returning id`
      : input.action === "unread"
        ? await tx`update notifications set read_at = null where id = ${id} returning id`
        : input.action === "archive"
          ? await tx`update notifications set archived_at = now(), read_at = coalesce(read_at, now()) where id = ${id} returning id`
          : await tx`update notifications set snoozed_until = now() + make_interval(hours => ${input.snoozeHours ?? 3}) where id = ${id} returning id`;
  if (rows.length === 0) throw notFound("Notification");
}

export async function markAllRead(tx: Tx) {
  await tx`update notifications set read_at = now() where read_at is null and archived_at is null`;
}

/**
 * Materialise notifications from the user's own data. Idempotent: every notification has a deterministic
 * dedupe key, so calling this on every page load never creates duplicates.
 *
 * Deliberately restrained to avoid overload:
 *   - deadlines: only items due within the next 24 h (tasks) / 48 h (assessments), one each
 *   - overdue:   a single digest per local day, never one-per-task
 *   - reminders: only those the user explicitly created
 * Categories can be switched off in Settings. A scheduled worker (Phase 8) would call the same function.
 */
export async function syncNotifications(tx: Tx, tz: string, prefs: Record<string, boolean>, now: Date = new Date()): Promise<void> {
  const on = (c: string) => prefs[c] !== false;
  const nowIso = now.toISOString();

  // Reminders are always marked fired once due, even if the category is muted, so they don't pile up.
  const due = await tx<{ id: string; taskId: string; title: string; remindAt: string }[]>`
    update reminders r set fired_at = ${nowIso} from tasks t
    where r.task_id = t.id and r.fired_at is null and r.remind_at <= ${nowIso} and t.deleted_at is null and t.status <> 'done'
    returning r.id, r.task_id, t.title, r.remind_at`;
  if (on("reminder")) {
    for (const r of due) {
      await tx`insert into notifications (category, title, body, href, dedupe_key)
               values ('reminder', ${"Reminder: " + r.title}, null, ${"/tasks"}, ${"reminder:" + r.id}) on conflict (user_id, dedupe_key) do nothing`;
    }
  }

  if (on("deadline")) {
    const tasks = await tx<{ id: string; title: string; dueAt: string }[]>`
      select id, title, due_at from tasks where status <> 'done' and deleted_at is null and due_at > ${nowIso} and due_at <= ${new Date(now.getTime() + 24 * 3600_000).toISOString()}
      order by due_at limit 20`;
    for (const t of tasks) {
      await tx`insert into notifications (category, title, body, href, dedupe_key)
               values ('deadline', ${"Due soon: " + t.title}, ${"Due " + dueLabel(t.dueAt, tz)}, '/tasks', ${"deadline:task:" + t.id + ":" + t.dueAt}) on conflict (user_id, dedupe_key) do nothing`;
    }
    const assessments = await tx<{ id: string; courseId: string; title: string; dueAt: string }[]>`
      select a.id, a.course_id, a.title, a.due_at from assessments a join courses c on c.id = a.course_id
      where a.score is null and c.deleted_at is null and a.due_at > ${nowIso} and a.due_at <= ${new Date(now.getTime() + 48 * 3600_000).toISOString()} order by a.due_at limit 20`;
    for (const a of assessments) {
      await tx`insert into notifications (category, title, body, href, dedupe_key)
               values ('deadline', ${"Coming up: " + a.title}, ${"Due " + dueLabel(a.dueAt, tz)}, ${"/courses/" + a.courseId}, ${"deadline:assessment:" + a.id + ":" + a.dueAt}) on conflict (user_id, dedupe_key) do nothing`;
    }
  }

  if (on("overdue")) {
    const [o] = await tx<{ n: number }[]>`select count(*) as n from tasks where status <> 'done' and deleted_at is null and due_at < ${nowIso}`;
    if (o && o.n > 0) {
      await tx`insert into notifications (category, title, body, href, dedupe_key)
               values ('overdue', ${`${o.n} overdue task${o.n === 1 ? "" : "s"}`}, 'Open your task list to reschedule or complete them.', '/tasks', ${"overdue:" + dateInTz(now, tz)})
               on conflict (user_id, dedupe_key) do nothing`;
    }
  }
}

function dueLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
