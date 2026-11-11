"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/server/runtime-types";

/**
 * Run a server action from a client component with pending state, field errors and toasts.
 * `run` resolves to true on success so callers can close dialogs / reset forms.
 */
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const toast = useToast();
  const router = useRouter();

  async function run<T>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; refresh?: boolean } = {}): Promise<{ ok: true; data: T } | { ok: false }> {
    setError(null);
    setFieldErrors({});
    return new Promise((resolve) => {
      start(async () => {
        const r = await fn();
        if (r.ok) {
          if (opts.success) toast.success(opts.success);
          if (opts.refresh) router.refresh();
          resolve({ ok: true, data: r.data });
        } else {
          setError(r.error);
          setFieldErrors(r.fieldErrors ?? {});
          toast.error(r.error);
          resolve({ ok: false });
        }
      });
    });
  }
  return { run, pending, error, fieldErrors, clearErrors: () => (setError(null), setFieldErrors({})) };
}
