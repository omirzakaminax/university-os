"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/app/actions/auth";

export function LoginForm({ deleted }: { deleted?: boolean }) {
  const { run, pending, error, fieldErrors } = useAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => loginAction({ email, password }));
      }}
    >
      <div>
        <h1 className="text-base font-semibold">Welcome back</h1>
        <p className="mt-0.5 text-xs text-subtle">Sign in to your workspace.</p>
      </div>
      {deleted && <p className="rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted">Your account and all of its data have been deleted.</p>}
      <FormError message={error} />
      <Field label="Email" error={fieldErrors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Field label="Password" error={fieldErrors.password}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
      <div className="flex justify-between text-xs">
        <Link href="/forgot-password" className="text-muted hover:text-fg">
          Forgot password?
        </Link>
        <Link href="/register" className="text-accent-text hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const { run, pending, error, fieldErrors } = useAction();
  const [v, setV] = useState({ displayName: "", email: "", password: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => registerAction(v));
      }}
    >
      <div>
        <h1 className="text-base font-semibold">Create your workspace</h1>
        <p className="mt-0.5 text-xs text-subtle">Free to start. Set up your university in the next step.</p>
      </div>
      <FormError message={error} />
      <Field label="Your name" error={fieldErrors.displayName}>
        {(p) => <Input {...p} autoComplete="name" required maxLength={100} value={v.displayName} onChange={set("displayName")} />}
      </Field>
      <Field label="Email" error={fieldErrors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required value={v.email} onChange={set("email")} />}
      </Field>
      <Field label="Password" hint="At least 8 characters." error={fieldErrors.password}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={v.password} onChange={set("password")} />}
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Create account
      </Button>
      <p className="text-center text-xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent-text hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const { run, pending, error, fieldErrors } = useAction();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ devLink: string | null } | null>(null);
  if (result) {
    return (
      <div className="space-y-3">
        <h1 className="text-base font-semibold">Check your options</h1>
        <p className="text-[13px] text-muted">If an account exists for that address, a reset link has been generated.</p>
        <p className="rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted">
          Email delivery is not configured on this server yet, so reset links cannot be emailed. The server administrator can enable an email provider, or you can ask them to reset your password.
        </p>
        {result.devLink && (
          <p className="rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning">
            Development mode only:{" "}
            <Link href={result.devLink} className="underline">
              open reset link
            </Link>
          </p>
        )}
        <Link href="/login" className="block text-center text-xs text-accent-text hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => forgotPasswordAction({ email })).then((r) => r.ok && setResult(r.data));
      }}
    >
      <div>
        <h1 className="text-base font-semibold">Reset your password</h1>
        <p className="mt-0.5 text-xs text-subtle">Enter your account email.</p>
      </div>
      <FormError message={error} />
      <Field label="Email" error={fieldErrors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Continue
      </Button>
      <Link href="/login" className="block text-center text-xs text-muted hover:text-fg">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { run, pending, error, fieldErrors } = useAction();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-base font-semibold">Password updated</h1>
        <p className="text-[13px] text-muted">You were signed out everywhere. Sign in with your new password.</p>
        <Link href="/login" className="inline-block text-sm text-accent-text hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => resetPasswordAction({ token, password })).then((r) => r.ok && setDone(true));
      }}
    >
      <h1 className="text-base font-semibold">Choose a new password</h1>
      <FormError message={error} />
      <Field label="New password" hint="At least 8 characters." error={fieldErrors.password}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Update password
      </Button>
    </form>
  );
}
