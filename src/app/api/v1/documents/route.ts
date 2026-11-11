import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/server/api";
import { AppError, normalizeError, validation } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";
import { parse, runAsUser } from "@/server/runtime";
import { MAX_UPLOAD_BYTES } from "@/domain/documents/validate";
import { id } from "@/server/schemas";
import { ingestDocument, listDocuments } from "@/server/services/documents";

const fail = (e: unknown) => {
  const err = normalizeError(e);
  return NextResponse.json({ error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } }, { status: err.status, headers: { "Cache-Control": "no-store" } });
};

const kindSchema = z.enum(["syllabus", "lecture", "textbook", "assignment", "regulation", "other"]);

export async function GET(req: NextRequest) {
  try {
    const q = parse(z.object({ courseId: id.optional(), kind: kindSchema.optional() }), Object.fromEntries(req.nextUrl.searchParams));
    return NextResponse.json({ data: await runAsUser((ctx) => listDocuments(ctx.tx, q)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

/** multipart/form-data: file, kind, optional courseId / topicId / title. Validated by content, size-limited, deduplicated. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw validation("The file is larger than 15 MB.", { file: "The file is larger than 15 MB." });
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw validation("Upload a file as multipart/form-data.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw validation("Choose a file to upload.", { file: "Choose a file" });
    const meta = parse(z.object({ kind: kindSchema.default("other"), courseId: id.nullish(), topicId: id.nullish(), title: z.string().trim().max(300).nullish() }), {
      kind: form.get("kind") || undefined,
      courseId: form.get("courseId") || undefined,
      topicId: form.get("topicId") || undefined,
      title: form.get("title") || undefined,
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const data = await runAsUser(async (ctx) => {
      enforceRateLimit(`upload:${ctx.userId}`, 30, 60 * 60_000);
      return ingestDocument(ctx.tx, { filename: file.name, bytes, kind: meta.kind, courseId: meta.courseId, topicId: meta.topicId, title: meta.title ?? undefined });
    });
    return NextResponse.json({ data }, { status: data.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

export { AppError };
