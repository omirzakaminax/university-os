/**
 * Dashboard widget registry. Only widgets backed by real, working data are listed.
 * Adding a widget = add it here + render it in src/components/dashboard/widgets.tsx.
 */
export interface WidgetDef {
  id: string;
  title: string;
  description: string;
  /** Grid span on wide screens (1 or 2 columns). */
  span: 1 | 2;
}

export const WIDGETS: WidgetDef[] = [
  { id: "today", title: "Today's timetable", description: "Classes scheduled for today", span: 1 },
  { id: "deadlines", title: "Upcoming deadlines", description: "Overdue and upcoming tasks and assessments", span: 1 },
  { id: "exams", title: "Upcoming exams", description: "Midterms, finals and exams that are not yet graded", span: 1 },
  { id: "tasks", title: "Priority tasks", description: "Open tasks ranked by priority and due date", span: 1 },
  { id: "performance", title: "Academic performance", description: "GPA so far and grade per course", span: 2 },
  { id: "courses", title: "Pinned courses", description: "Quick access to your pinned courses", span: 1 },
  { id: "notes", title: "Quick notes", description: "Capture and review notes", span: 1 },
  { id: "ai", title: "AI daily briefing", description: "Shows whether an AI provider is configured", span: 1 },
];

export interface WidgetPref {
  id: string;
  visible: boolean;
}

/**
 * Merge stored preferences with the registry: drop unknown ids, keep stored order/visibility,
 * and append newly introduced widgets (visible) at the end.
 */
export function normalizeWidgetPrefs(stored: unknown): WidgetPref[] {
  const known = new Set(WIDGETS.map((w) => w.id));
  const seen = new Set<string>();
  const out: WidgetPref[] = [];
  if (Array.isArray(stored)) {
    for (const item of stored) {
      if (!item || typeof item !== "object") continue;
      const { id, visible } = item as { id?: unknown; visible?: unknown };
      if (typeof id !== "string" || !known.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, visible: visible !== false });
    }
  }
  for (const w of WIDGETS) if (!seen.has(w.id)) out.push({ id: w.id, visible: true });
  return out;
}
