/** Client-safe notification category metadata (no server imports). */
export const NOTIFICATION_CATEGORIES = [
  { id: "deadline", label: "Deadlines", description: "Tasks and assessments due within the next 24–48 hours" },
  { id: "reminder", label: "Reminders", description: "Reminders you set on tasks" },
  { id: "overdue", label: "Overdue digest", description: "At most one summary per day of overdue tasks" },
] as const;
