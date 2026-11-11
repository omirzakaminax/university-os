"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, Plus, Search, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/form";
import { CommandPalette } from "@/components/shell/command-palette";
import { QuickCapture, type CourseOption } from "@/components/shell/quick-capture";
import { NAV } from "@/components/shell/nav";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { logoutAction } from "@/app/actions/auth";
import { setActivePeriodAction, updatePreferencesAction } from "@/app/actions/data";
import { cn } from "@/lib/cn";

export interface ShellProps {
  children: ReactNode;
  userName: string;
  email: string;
  unread: number;
  collapsedInitially: boolean;
  timezone: string;
  institution: string;
  periods: { id: string; label: string }[];
  activePeriodId: string;
  courses: CourseOption[];
  theme: "light" | "dark" | "system";
}

const SHORTCUTS: [string, string][] = [
  ["⌘ / Ctrl + K", "Open the command palette"],
  ["C", "Quick capture a task or note"],
  ["G then D / C / T / A / M / G / N / O / S", "Go to Dashboard / Courses / Tasks / Calendar / Timetable / Grades / Notes / Notifications / Settings"],
  ["[", "Collapse or expand the sidebar"],
  ["?", "Show this list"],
  ["Esc", "Close any dialog"],
];

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function AppShell(props: ShellProps) {
  const { children, collapsedInitially } = props;
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(collapsedInitially);
  const [drawerPath, setDrawerPath] = useState<string | null>(null);
  // The drawer is "open for this path": navigating anywhere closes it without an effect.
  const drawer = drawerPath === pathname;
  const setDrawer = (open: boolean) => setDrawerPath(open ? pathname : null);
  const [palette, setPalette] = useState(false);
  const [capture, setCapture] = useState(false);
  const [help, setHelp] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      void updatePreferencesAction({ sidebarCollapsed: !c });
      return !c;
    });
  }, []);

  useEffect(() => {
    let chord = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (chord) {
        chord = false;
        clearTimeout(timer);
        const item = NAV.find((n) => n.chord === e.key.toLowerCase());
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (e.key === "g") {
        chord = true;
        timer = setTimeout(() => (chord = false), 900);
      } else if (e.key === "c") {
        e.preventDefault();
        setCapture(true);
      } else if (e.key === "[") toggleCollapsed();
      else if (e.key === "?") setHelp(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggleCollapsed]);

  const nav = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            title={collapsed ? n.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn("group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors", active ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-hover hover:text-fg", collapsed && "lg:justify-center lg:px-0")}
          >
            <n.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className={cn("truncate", collapsed && "lg:sr-only")}>{n.label}</span>
            {n.href === "/notifications" && props.unread > 0 && (
              <span className={cn("ml-auto rounded-full bg-accent px-1.5 text-[10px] font-semibold text-on-accent", collapsed && "lg:hidden")} aria-label={`${props.unread} unread`}>
                {props.unread > 99 ? "99+" : props.unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <>
      <div className={cn("flex h-12 items-center justify-between px-4", collapsed && "lg:justify-center lg:px-0")}>
        <Logo withText={!collapsed} />
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Close menu" onClick={() => setDrawer(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className={cn("px-3 pb-2", collapsed && "lg:hidden")}>
        <Select aria-label="Academic period" value={props.activePeriodId} onChange={(e) => void setActivePeriodAction(e.target.value).then(() => router.refresh())} className="h-7 text-xs">
          {props.periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      </div>
      {nav}
      <div className="hidden border-t border-line p-2 lg:block">
        <Button variant="ghost" size="sm" className={cn("w-full justify-start", collapsed && "justify-center")} onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-1.5 focus:text-on-accent">Skip to content</a>
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex", collapsed ? "w-14" : "w-60")}>{sidebarInner}</aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-overlay" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 animate-fade-in flex-col border-r border-line bg-surface">{sidebarInner}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-bg/85 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <button onClick={() => setPalette(true)} className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-left text-[13px] text-subtle transition-colors hover:border-line-strong sm:max-w-sm sm:flex-none sm:basis-80" aria-label="Open search and command palette">
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Search or jump to…</span>
            <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[10px] sm:block">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <div className="hidden sm:block"><ThemeSwitcher saved={props.theme} compact /></div>
            <Button variant="primary" size="sm" onClick={() => setCapture(true)} aria-label="Quick capture">
              <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Capture</span>
            </Button>
            <Link href="/notifications" className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg" aria-label={props.unread ? `Notifications, ${props.unread} unread` : "Notifications"}>
              <Bell className="h-4 w-4" />
              {props.unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label={`Sign out ${props.userName}`} title={`Sign out (${props.email})`}>
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>

      <CommandPalette open={palette} onOpenChange={setPalette} onQuickCapture={() => setCapture(true)} onShortcuts={() => setHelp(true)} />
      <QuickCapture open={capture} onOpenChange={setCapture} courses={props.courses} timezone={props.timezone} />
      <Dialog open={help} onOpenChange={setHelp} title="Keyboard shortcuts">
        <dl className="space-y-2.5">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="flex items-start justify-between gap-4 text-[13px]">
              <dd className="text-muted">{d}</dd>
              <dt className="shrink-0"><kbd className="rounded border border-line bg-raised px-1.5 py-0.5 text-[11px]">{k}</kbd></dt>
            </div>
          ))}
        </dl>
      </Dialog>
    </div>
  );
}
