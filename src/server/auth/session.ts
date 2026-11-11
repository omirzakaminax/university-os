import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { localAuthProvider } from "@/server/auth/local-provider";
import type { AuthProvider, SessionInfo } from "@/server/auth/provider";

export const SESSION_COOKIE = "uos_session";

export function authProvider(): AuthProvider {
  switch (env().AUTH_PROVIDER) {
    case "local":
      return localAuthProvider;
  }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Session token from the cookie (web) or `Authorization: Bearer` (future mobile clients). */
export async function currentToken(): Promise<string | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Resolve the signed-in user once per request. */
export const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = await currentToken();
  if (!token) return null;
  return authProvider().verifySession(token);
});

export async function requireSession(): Promise<SessionInfo> {
  const s = await getSession();
  if (!s) throw new AppError("unauthorized", "Please sign in");
  return s;
}

/** Best-effort client identifier for rate limiting. */
export async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
