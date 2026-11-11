"use server";

import { redirect } from "next/navigation";
import { env } from "@/server/env";
import { AppError, normalizeError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { authProvider, clearSessionCookie, clientKey, currentToken, requireSession, setSessionCookie } from "@/server/auth/session";
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema } from "@/server/schemas";
import { parse, type ActionResult } from "@/server/runtime";
import { headers } from "next/headers";

function fail(e: unknown): ActionResult<never> {
  if (typeof e === "object" && e && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
  const err = normalizeError(e);
  return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
}

export async function registerAction(input: unknown): Promise<ActionResult<never>> {
  try {
    const ip = await clientKey();
    enforceRateLimit(`register:${ip}`, 10, 60 * 60_000);
    const data = parse(registerSchema, input);
    const auth = authProvider();
    await auth.signUp(data);
    const ua = (await headers()).get("user-agent") ?? undefined;
    const session = await auth.signIn({ email: data.email, password: data.password, userAgent: ua });
    await setSessionCookie(session.token, session.expiresAt);
  } catch (e) {
    return fail(e);
  }
  redirect("/onboarding");
}

export async function loginAction(input: unknown): Promise<ActionResult<never>> {
  try {
    const data = parse(loginSchema, input);
    const ip = await clientKey();
    enforceRateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
    enforceRateLimit(`login:email:${data.email}`, 8, 15 * 60_000);
    const ua = (await headers()).get("user-agent") ?? undefined;
    const session = await authProvider().signIn({ ...data, userAgent: ua });
    await setSessionCookie(session.token, session.expiresAt);
  } catch (e) {
    return fail(e);
  }
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const token = await currentToken();
  if (token) await authProvider().signOut(token);
  await clearSessionCookie();
  redirect("/login");
}

/**
 * Always answers identically whether or not the account exists. No email provider is integrated yet, so the
 * reset link is only ever surfaced in development (AUTH_DEV_SHOW_RESET_LINK=1) — never emailed, never in production.
 */
export async function forgotPasswordAction(input: unknown): Promise<ActionResult<{ devLink: string | null; emailConfigured: boolean }>> {
  try {
    const data = parse(forgotSchema, input);
    enforceRateLimit(`forgot:ip:${await clientKey()}`, 10, 60 * 60_000);
    enforceRateLimit(`forgot:email:${data.email}`, 3, 60 * 60_000);
    const r = await authProvider().createPasswordReset(data.email);
    const showDev = env().AUTH_DEV_SHOW_RESET_LINK === "1" && env().NODE_ENV !== "production";
    return { ok: true, data: { devLink: r && showDev ? `/reset-password?token=${r.token}` : null, emailConfigured: false } };
  } catch (e) {
    return fail(e);
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult<{ done: true }>> {
  try {
    const data = parse(resetSchema, input);
    enforceRateLimit(`reset:ip:${await clientKey()}`, 10, 60 * 60_000);
    await authProvider().resetPassword({ token: data.token, newPassword: data.password });
    return { ok: true, data: { done: true } };
  } catch (e) {
    return fail(e);
  }
}

export async function changePasswordAction(input: unknown): Promise<ActionResult<{ done: true }>> {
  try {
    const session = await requireSession();
    const data = parse(changePasswordSchema, input);
    enforceRateLimit(`chpw:${session.userId}`, 5, 15 * 60_000);
    await authProvider().changePassword({ userId: session.userId, ...data, keepSessionToken: (await currentToken()) ?? undefined });
    return { ok: true, data: { done: true } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAccountAction(input: { confirmEmail: string }): Promise<ActionResult<never>> {
  try {
    const session = await requireSession();
    if (input?.confirmEmail?.trim().toLowerCase() !== session.email.toLowerCase()) {
      throw new AppError("validation", "Type your email address to confirm", { confirmEmail: "Does not match your account email" });
    }
    await authProvider().deleteUser(session.userId);
    await clearSessionCookie();
  } catch (e) {
    return fail(e);
  }
  redirect("/login?deleted=1");
}
