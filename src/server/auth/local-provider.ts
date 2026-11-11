import { adminSql } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { hashPassword, hashToken, newToken, verifyPassword } from "@/server/auth/password";
import type { AuthProvider, SessionInfo } from "@/server/auth/provider";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
// Used to equalise timing between "unknown email" and "wrong password".
let dummyHash: Promise<string> | undefined;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const localAuthProvider: AuthProvider = {
  async signUp({ email, password, displayName }) {
    const sql = adminSql();
    const hash = await hashPassword(password);
    try {
      return await sql.begin(async (tx) => {
        const [user] = await tx<{ id: string }[]>`
          insert into auth.users (email, raw_user_meta_data, email_confirmed_at)
          values (${normalizeEmail(email)}, ${tx.json({ display_name: displayName })}, now())
          returning id`;
        await tx`insert into local_auth.credentials (user_id, password_hash) values (${user!.id}, ${hash})`;
        return { userId: user!.id };
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505") throw new AppError("conflict", "An account with this email already exists", { email: "An account with this email already exists" });
      throw e;
    }
  },

  async signIn({ email, password, userAgent }) {
    const sql = adminSql();
    const [row] = await sql<{ id: string; passwordHash: string }[]>`
      select u.id, c.password_hash from auth.users u join local_auth.credentials c on c.user_id = u.id
      where u.email = ${normalizeEmail(email)}`;
    dummyHash ??= hashPassword("not-a-real-password");
    const ok = await verifyPassword(password, row?.passwordHash ?? (await dummyHash));
    if (!row || !ok) throw new AppError("unauthorized", "Incorrect email or password");
    const { token, hash } = newToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await sql`insert into local_auth.sessions (token_hash, user_id, user_agent, expires_at) values (${hash}, ${row.id}, ${userAgent?.slice(0, 300) ?? null}, ${expiresAt})`;
    return { token, expiresAt, userId: row.id };
  },

  async verifySession(token): Promise<SessionInfo | null> {
    if (!token || token.length > 200) return null;
    const sql = adminSql();
    const [row] = await sql<{ userId: string; email: string }[]>`
      update local_auth.sessions s set last_used_at = now()
      from auth.users u
      where s.token_hash = ${hashToken(token)} and s.expires_at > now() and u.id = s.user_id
      returning s.user_id, u.email`;
    return row ? { userId: row.userId, email: row.email } : null;
  },

  async signOut(token) {
    await adminSql()`delete from local_auth.sessions where token_hash = ${hashToken(token)}`;
  },

  async createPasswordReset(email) {
    const sql = adminSql();
    const [u] = await sql<{ id: string }[]>`select id from auth.users where email = ${normalizeEmail(email)}`;
    if (!u) return null;
    const { token, hash } = newToken();
    await sql`insert into local_auth.password_resets (token_hash, user_id, expires_at) values (${hash}, ${u.id}, ${new Date(Date.now() + RESET_TTL_MS)})`;
    return { token };
  },

  async resetPassword({ token, newPassword }) {
    const sql = adminSql();
    const hash = await hashPassword(newPassword);
    await sql.begin(async (tx) => {
      const [r] = await tx<{ userId: string }[]>`
        update local_auth.password_resets set used_at = now()
        where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
        returning user_id`;
      if (!r) throw new AppError("validation", "This reset link is invalid or has expired");
      await tx`update local_auth.credentials set password_hash = ${hash}, updated_at = now() where user_id = ${r.userId}`;
      // A password reset signs out every device.
      await tx`delete from local_auth.sessions where user_id = ${r.userId}`;
    });
  },

  async changePassword({ userId, currentPassword, newPassword, keepSessionToken }) {
    const sql = adminSql();
    const [row] = await sql<{ passwordHash: string }[]>`select password_hash from local_auth.credentials where user_id = ${userId}`;
    if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
      throw new AppError("validation", "Current password is incorrect", { currentPassword: "Current password is incorrect" });
    }
    const hash = await hashPassword(newPassword);
    await sql.begin(async (tx) => {
      await tx`update local_auth.credentials set password_hash = ${hash}, updated_at = now() where user_id = ${userId}`;
      await tx`delete from local_auth.sessions where user_id = ${userId} and token_hash <> ${keepSessionToken ? hashToken(keepSessionToken) : ""}`;
    });
  },

  async deleteUser(userId) {
    // Cascades to every user-owned row via ON DELETE CASCADE.
    await adminSql()`delete from auth.users where id = ${userId}`;
  },
};
