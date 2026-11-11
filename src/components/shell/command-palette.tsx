"use client";

import { Command } from "cmdk";
import * as RD from "@radix-ui/react-dialog";
import { BookOpen, CheckSquare, FileText, Keyboard, NotebookPen, Plus, Search, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { searchAction } from "@/app/actions/data";
import { NAV } from "@/components/shell/nav";
import type { SearchHit } from "@/server/services/search";

const ICON: Record<SearchHit["type"], ReactNode> = {
  course: <BookOpen className="h-3.5 w-3.5" />,
  task: <CheckSquare className="h-3.5 w-3.5" />,
  note: <NotebookPen className="h-3.5 w-3.5" />,
  assessment: <GraduationCap className="h-3.5 w-3.5" />,
};

export function CommandPalette({ open, onOpenChange, onQuickCapture, onShortcuts }: { open: boolean; onOpenChange: (o: boolean) => void; onQuickCapture: () => void; onShortcuts: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; hits: SearchHit[]; error: string | null }>({ q: "", hits: [], error: null });
  const q = query.trim();
  const active = open && q.length >= 2;
  const fresh = active && results.q === q;
  const hits = fresh ? results.hits : [];
  const searchError = fresh ? results.error : null;
  const searching = active && !fresh;

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(async () => {
      const r = await searchAction(q);
      setResults({ q, hits: r.ok ? r.data : [], error: r.ok ? null : r.error });
    }, 180);
    return () => clearTimeout(t);
  }, [q, active]);

  const handleOpenChange = (o: boolean) => {
    if (!o) setQuery("");
    onOpenChange(o);
  };

  const go = (href: string) => {
    handleOpenChange(false);
    router.push(href);
  };
  const act = (fn: () => void) => {
    handleOpenChange(false);
    setTimeout(fn, 0);
  };

  return (
    <RD.Root open={open} onOpenChange={handleOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <RD.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line-strong bg-surface shadow-pop data-[state=open]:animate-pop" aria-describedby={undefined}>
          <RD.Title className="sr-only">Command palette</RD.Title>
          <Command label="Command palette" shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="h-4 w-4 text-subtle" aria-hidden />
              <Command.Input value={query} onValueChange={setQuery} placeholder="Search courses, tasks, notes — or jump to a page…" className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle" />
              <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-subtle">esc</kbd>
            </div>
            <Command.List className="max-h-[52vh] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-8 text-center text-xs text-subtle">{searching ? "Searching…" : q.length >= 2 ? "No matches in your workspace." : "Type to search."}</Command.Empty>
              {searchError && <p className="px-3 py-2 text-xs text-danger">{searchError}</p>}
              {hits.length > 0 && (
                <Command.Group heading="Results" className={groupCls}>
                  {hits.map((h) => (
                    <Item key={`${h.type}:${h.id}`} value={`${h.type}:${h.id}`} onSelect={() => go(h.href)} icon={ICON[h.type]}>
                      <span className="truncate">{h.title}</span>
                      {h.subtitle && <span className="ml-auto shrink-0 text-xs text-subtle">{h.subtitle}</span>}
                    </Item>
                  ))}
                </Command.Group>
              )}
              {q.length < 2 && (
                <>
                  <Command.Group heading="Create" className={groupCls}>
                    <Item value="new-capture" onSelect={() => act(onQuickCapture)} icon={<Plus className="h-3.5 w-3.5" />}>
                      Quick capture (task or note)<Kbd>C</Kbd>
                    </Item>
                    <Item value="new-course" onSelect={() => go("/courses?new=1")} icon={<BookOpen className="h-3.5 w-3.5" />}>Add a course</Item>
                  </Command.Group>
                  <Command.Group heading="Go to" className={groupCls}>
                    {NAV.map((n) => (
                      <Item key={n.href} value={`go-${n.label}`} onSelect={() => go(n.href)} icon={<n.icon className="h-3.5 w-3.5" />}>
                        {n.label}
                        <Kbd>G {n.chord.toUpperCase()}</Kbd>
                      </Item>
                    ))}
                  </Command.Group>
                  <Command.Group heading="Help" className={groupCls}>
                    <Item value="shortcuts" onSelect={() => act(onShortcuts)} icon={<Keyboard className="h-3.5 w-3.5" />}>Keyboard shortcuts<Kbd>?</Kbd></Item>
                    <Item value="export" onSelect={() => { handleOpenChange(false); downloadFile("/api/v1/me/export"); }} icon={<FileText className="h-3.5 w-3.5" />}>Export all my data (JSON)</Item>
                  </Command.Group>
                </>
              )}
            </Command.List>
          </Command>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

const groupCls = "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-subtle";

function Item({ children, icon, ...props }: { children: ReactNode; icon: ReactNode; value: string; onSelect: () => void }) {
  return (
    <Command.Item {...props} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted aria-selected:bg-hover aria-selected:text-fg">
      <span className="text-subtle">{icon}</span>
      {children}
    </Command.Item>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px] text-subtle">{children}</kbd>;
}

/** Trigger a browser download for a same-origin URL. */
function downloadFile(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
