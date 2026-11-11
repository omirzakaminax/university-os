import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-fg placeholder:text-subtle transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-8", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, "h-8 appearance-none bg-no-repeat pr-7", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%239097a8' stroke-width='2'%3E%3Cpath d='m3 4.5 3 3 3-3'/%3E%3C/svg%3E\")", backgroundPosition: "right 8px center" }} {...props}>
      {children}
    </select>
  );
});

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + hint/error wiring for accessible forms. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": error || hint ? descId : undefined })}
      {(error || hint) && (
        <p id={descId} role={error ? "alert" : undefined} className={cn("text-xs", error ? "text-danger" : "text-subtle")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {message}
    </p>
  );
}
