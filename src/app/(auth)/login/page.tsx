import type { Metadata } from "next";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  return <LoginForm deleted={(await searchParams).deleted === "1"} />;
}
