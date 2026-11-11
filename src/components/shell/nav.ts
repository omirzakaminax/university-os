import { Bell, BookOpen, CalendarDays, CheckSquare, GraduationCap, LayoutDashboard, NotebookPen, Settings, Clock, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Second key of the `g` chord, e.g. g then d. */
  chord: string;
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, chord: "d" },
  { href: "/courses", label: "Courses", icon: BookOpen, chord: "c" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, chord: "t" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, chord: "a" },
  { href: "/timetable", label: "Timetable", icon: Clock, chord: "m" },
  { href: "/grades", label: "Grades", icon: GraduationCap, chord: "g" },
  { href: "/notes", label: "Notes", icon: NotebookPen, chord: "n" },
  { href: "/notifications", label: "Notifications", icon: Bell, chord: "o" },
  { href: "/settings", label: "Settings", icon: Settings, chord: "s" },
];
