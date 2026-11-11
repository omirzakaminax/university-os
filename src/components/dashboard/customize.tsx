"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAction } from "@/components/ui/use-action";
import { updatePreferencesAction } from "@/app/actions/data";
import { WIDGETS, type WidgetPref } from "@/domain/widgets";
import { cn } from "@/lib/cn";

export function CustomizeDashboard({ prefs }: { prefs: WidgetPref[] }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(prefs);
  const { run, pending, error } = useAction();
  const title = (id: string) => WIDGETS.find((w) => w.id === id)?.title ?? id;
  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setList(next);
  };
  return (
    <>
      <Button onClick={() => { setList(prefs); setOpen(true); }}>
        <SlidersHorizontal className="h-3.5 w-3.5" /> Customize
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Customize dashboard" description="Show, hide and reorder widgets. Saved to your account.">
        <ul className="space-y-1.5">
          {list.map((w, i) => (
            <li key={w.id} className="flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-1.5">
              <span className={cn("min-w-0 flex-1 truncate text-[13px]", !w.visible && "text-subtle line-through")}>{title(w.id)}</span>
              <Button variant="ghost" size="icon" aria-label={`Move ${title(w.id)} up`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Move ${title(w.id)} down`} onClick={() => move(i, 1)} disabled={i === list.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" aria-label={`${w.visible ? "Hide" : "Show"} ${title(w.id)}`} aria-pressed={w.visible} onClick={() => setList(list.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)))}>
                {w.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
            </li>
          ))}
        </ul>
        {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" loading={pending} onClick={async () => { const r = await run(() => updatePreferencesAction({ dashboardWidgets: list }), { success: "Dashboard saved" }); if (r.ok) setOpen(false); }}>Save layout</Button>
        </div>
      </Dialog>
    </>
  );
}
