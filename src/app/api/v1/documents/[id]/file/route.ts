import { NextResponse, type NextRequest } from "next/server";
import { normalizeError } from "@/server/errors";
import { parse, runAsUser } from "@/server/runtime";
import { id } from "@/server/schemas";
import { getDocumentFile } from "@/server/services/documents";

/**
 * Download an original file. Always sent as an attachment with a locked-down sandbox CSP and nosniff, so an
 * uploaded file can never execute as a page in the app's origin.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const docId = parse(id, (await ctx.params).id);
    const { doc, data } = await runAsUser((c) => getDocumentFile(c.tx, docId));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.originalFilename)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const err = normalizeError(e);
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
}
