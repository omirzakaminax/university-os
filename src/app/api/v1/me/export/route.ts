import { NextResponse, type NextRequest } from "next/server";
import { AppError, normalizeError } from "@/server/errors";
import { runAsUser } from "@/server/runtime";
import { exportAllData } from "@/server/services/export";

/** Full export of the caller's own data. GET-only; protected by the session cookie / bearer token + RLS. */
export async function GET(_req: NextRequest) {
  try {
    const data = await runAsUser((ctx) => exportAllData(ctx.tx));
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="university-os-export.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const err = e instanceof AppError ? e : normalizeError(e);
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
}
