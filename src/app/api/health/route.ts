import { NextResponse } from "next/server";
import { appSql } from "@/server/db/client";

/** Liveness + database reachability. Reveals nothing beyond up/down. */
export async function GET() {
  try {
    await appSql()`select 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
