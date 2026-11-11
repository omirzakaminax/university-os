import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { AppError, normalizeError, validation } from "@/server/errors";
import { runAsUser, parse, type UserCtx } from "@/server/runtime";

interface RouteContext<P> { params: Promise<P> }

export interface ApiArgs<P> {
  ctx: UserCtx;
  req: NextRequest;
  params: P;
  /** Parsed JSON body (undefined for GET/DELETE). */
  body: unknown;
}

/**
 * REST handler wrapper for /api/v1 — the contract future mobile clients use.
 *  - authenticates via session cookie OR `Authorization: Bearer <session token>`
 *  - CSRF defence: cookie-authenticated state-changing requests must be same-origin
 *  - consistent JSON error envelope: { error: { code, message, fieldErrors? } }
 */
/** CSRF defence for cookie-authenticated, state-changing requests: the Origin header must match this host. */
export function assertSameOrigin(req: NextRequest) {
  const usesBearer = req.headers.get("authorization")?.toLowerCase().startsWith("bearer ");
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || usesBearer) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new AppError("forbidden", "Cross-origin request blocked");
}

export function route<P = Record<string, never>>(handler: (args: ApiArgs<P>) => Promise<unknown>, opts: { successStatus?: number } = {}) {
  return async (req: NextRequest, context: RouteContext<P>): Promise<NextResponse> => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      assertSameOrigin(req);
      let body: unknown;
      if (mutating && req.method !== "DELETE") {
        try {
          body = await req.json();
        } catch {
          throw validation("Request body must be valid JSON");
        }
      }
      const params = await context.params;
      const data = await runAsUser((ctx) => handler({ ctx, req, params, body }));
      return NextResponse.json({ data }, { status: opts.successStatus ?? 200, headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      const err = normalizeError(e);
      return NextResponse.json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } }, { status: err.status, headers: { "Cache-Control": "no-store" } });
    }
  };
}

export { parse };
export type { z };
