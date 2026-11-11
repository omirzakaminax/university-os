import { afterAll, describe, expect, it } from "vitest";
import { adminSql, closeAll, localAuthProvider as auth, createUser, withUser } from "./helpers";

afterAll(closeAll);

const pw = "correct horse battery";

describe("local auth provider", () => {
  it("registers a user and a trigger creates their profile + preferences", async () => {
    const { userId } = await createUser("reg");
    await withUser(userId, async (tx) => {
      const [p] = await tx`select display_name, timezone, onboarding_completed_at from profiles`;
      expect(p!.displayName).toBe("REG");
      expect(p!.onboardingCompletedAt).toBeNull();
      const [pref] = await tx`select sidebar_collapsed from user_preferences`;
      expect(pref).toBeDefined();
    });
  });

  it("rejects duplicate emails (case-insensitively)", async () => {
    const { email } = await createUser("dup");
    await expect(auth.signUp({ email: email.toUpperCase(), password: pw, displayName: "x" })).rejects.toMatchObject({ code: "conflict" });
  });

  it("stores only a password hash and only a session token hash", async () => {
    const { userId, email } = await createUser("hash");
    const s = await auth.signIn({ email, password: pw });
    const [cred] = await adminSql()`select password_hash from local_auth.credentials where user_id = ${userId}`;
    expect(cred!.passwordHash).toMatch(/^scrypt\$/);
    expect(cred!.passwordHash).not.toContain(pw);
    const rows = await adminSql()`select token_hash from local_auth.sessions where user_id = ${userId}`;
    expect(rows.map((r) => r.tokenHash)).not.toContain(s.token);
  });

  it("signs in, verifies and signs out", async () => {
    const { userId, email } = await createUser("flow");
    const s = await auth.signIn({ email: email.toUpperCase(), password: pw });
    expect(await auth.verifySession(s.token)).toEqual({ userId, email });
    await auth.signOut(s.token);
    expect(await auth.verifySession(s.token)).toBeNull();
  });

  it("gives the same error for wrong password and unknown email", async () => {
    const { email } = await createUser("bad");
    const wrong = await auth.signIn({ email, password: "nope-nope-nope" }).catch((e) => e);
    const unknown = await auth.signIn({ email: "nobody@example.test", password: "nope-nope-nope" }).catch((e) => e);
    expect(wrong.code).toBe("unauthorized");
    expect(unknown.code).toBe("unauthorized");
    expect(wrong.message).toBe(unknown.message);
  });

  it("rejects expired sessions and garbage tokens", async () => {
    const { userId, email } = await createUser("exp");
    const s = await auth.signIn({ email, password: pw });
    await adminSql()`update local_auth.sessions set expires_at = now() - interval '1 minute' where user_id = ${userId}`;
    expect(await auth.verifySession(s.token)).toBeNull();
    expect(await auth.verifySession("")).toBeNull();
    expect(await auth.verifySession("x".repeat(500))).toBeNull();
  });

  it("password reset: single use, changes password, revokes all sessions", async () => {
    const { email } = await createUser("reset");
    const s = await auth.signIn({ email, password: pw });
    const r = await auth.createPasswordReset(email);
    expect(r).not.toBeNull();
    await auth.resetPassword({ token: r!.token, newPassword: "a brand new password" });
    expect(await auth.verifySession(s.token)).toBeNull();
    await expect(auth.signIn({ email, password: pw })).rejects.toMatchObject({ code: "unauthorized" });
    await expect(auth.signIn({ email, password: "a brand new password" })).resolves.toBeDefined();
    await expect(auth.resetPassword({ token: r!.token, newPassword: "yet another password" })).rejects.toMatchObject({ code: "validation" });
  });

  it("password reset for unknown email yields nothing (no enumeration signal at the provider level)", async () => {
    expect(await auth.createPasswordReset("ghost@example.test")).toBeNull();
  });

  it("expired reset tokens are rejected", async () => {
    const { email } = await createUser("resetexp");
    const r = await auth.createPasswordReset(email);
    await adminSql()`update local_auth.password_resets set expires_at = now() - interval '1 second'`;
    await expect(auth.resetPassword({ token: r!.token, newPassword: "a brand new password" })).rejects.toMatchObject({ code: "validation" });
  });

  it("changePassword requires the current password and keeps only the current session", async () => {
    const { userId, email } = await createUser("chpw");
    const keep = await auth.signIn({ email, password: pw });
    const other = await auth.signIn({ email, password: pw });
    await expect(auth.changePassword({ userId, currentPassword: "wrong", newPassword: "a brand new password" })).rejects.toMatchObject({ code: "validation" });
    await auth.changePassword({ userId, currentPassword: pw, newPassword: "a brand new password", keepSessionToken: keep.token });
    expect(await auth.verifySession(keep.token)).not.toBeNull();
    expect(await auth.verifySession(other.token)).toBeNull();
  });

  it("deleting a user cascades to all their data", async () => {
    const { userId } = await createUser("del");
    await auth.deleteUser(userId);
    const [{ n }] = (await adminSql()`select count(*) as n from profiles where id = ${userId}`) as unknown as [{ n: number }];
    expect(n).toBe(0);
  });
});
