/**
 * Authentication provider abstraction. The rest of the app only knows this interface and the
 * resulting user id; that id is what Row Level Security (`auth.uid()`) is keyed on.
 *
 * Implemented: "local" (src/server/auth/local-provider.ts) — passwords + opaque sessions stored in Postgres.
 * Planned:     "supabase" — GoTrue via Supabase Auth; would implement the same interface (see docs/ARCHITECTURE.md).
 */
export interface SessionInfo {
  userId: string;
  email: string;
}

export interface AuthProvider {
  signUp(input: { email: string; password: string; displayName: string }): Promise<{ userId: string }>;
  /** Returns an opaque session token. Throws AppError("unauthorized") on bad credentials. */
  signIn(input: { email: string; password: string; userAgent?: string }): Promise<{ token: string; expiresAt: Date; userId: string }>;
  verifySession(token: string): Promise<SessionInfo | null>;
  signOut(token: string): Promise<void>;
  /** Returns a one-time reset token if the account exists (caller decides delivery), else null. */
  createPasswordReset(email: string): Promise<{ token: string } | null>;
  resetPassword(input: { token: string; newPassword: string }): Promise<void>;
  changePassword(input: { userId: string; currentPassword: string; newPassword: string; keepSessionToken?: string }): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}
