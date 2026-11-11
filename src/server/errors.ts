/** Application error taxonomy. Anything thrown that is not an AppError is treated as an internal error. */
export type ErrorCode = "validation" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "rate_limited" | "unavailable";

const STATUS: Record<ErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  unavailable: 503,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string>;
  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
  get status(): number {
    return STATUS[this.code];
  }
}

export const notFound = (what = "Record") => new AppError("not_found", `${what} not found`);
export const validation = (message: string, fieldErrors?: Record<string, string>) => new AppError("validation", message, fieldErrors);

type PgError = { code?: string; constraint_name?: string; message?: string };

/**
 * Translate low-level Postgres errors into AppErrors without leaking schema details.
 * RLS violations (42501) and composite-FK violations (23503) are what a cross-tenant attempt looks like.
 */
export function normalizeError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const pg = err as PgError;
  switch (pg?.code) {
    case "42501":
      return new AppError("forbidden", "You do not have access to that resource");
    case "23503":
      return new AppError("validation", "A referenced record does not exist");
    case "23505":
      return new AppError("conflict", "That record already exists");
    case "23514":
    case "22P02":
    case "22007":
    case "22003":
    case "23502":
      return new AppError("validation", "One of the values is not valid");
    default:
      console.error("[internal-error]", err);
      return new AppError("unavailable", "Something went wrong. Please try again.");
  }
}
