import { createHash } from "node:crypto";
import type { Tx } from "@/server/db/client";
import { notFound, validation } from "@/server/errors";
import { chunkPages } from "@/domain/documents/chunk";
import { sanitizeFilename, sniffFile, titleFromFilename } from "@/domain/documents/validate";
import { extractPages } from "@/server/documents/extract";
import { audit } from "@/server/services/audit";
import { likePattern } from "@/server/services/search";

export type DocumentKind = "syllabus" | "lecture" | "textbook" | "assignment" | "regulation" | "other";

export interface DocumentRow {
  id: string;
  courseId: string | null;
  topicId: string | null;
  kind: DocumentKind;
  title: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  status: "processing" | "ready" | "needs_ocr" | "failed";
  statusDetail: string | null;
  pageCount: number | null;
  charCount: number | null;
  createdAt: string;
}

const cols = (tx: Tx) => tx`id, course_id, topic_id, kind, title, original_filename, mime_type, size_bytes, status, status_detail, page_count, char_count, created_at`;

export interface IngestInput {
  filename: string;
  bytes: Uint8Array;
  kind: DocumentKind;
  courseId?: string | null;
  topicId?: string | null;
  title?: string;
}

/**
 * Upload → validation → (dedupe) → store → extraction → chunking → indexing.
 * Identical files in the same course are recognised by SHA-256 and never re-processed.
 */
export async function ingestDocument(tx: Tx, input: IngestInput): Promise<{ document: DocumentRow; duplicate: boolean }> {
  const sniff = sniffFile(input.filename, input.bytes);
  if (!sniff.ok) throw validation(sniff.reason, { file: sniff.reason });
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const courseId = input.courseId ?? null;

  const [dup] = await tx<DocumentRow[]>`
    select ${cols(tx)} from documents where sha256 = ${sha256} and deleted_at is null and course_id is not distinct from ${courseId}`;
  if (dup) return { document: dup, duplicate: true };

  const filename = sanitizeFilename(input.filename);
  const [doc] = await tx<{ id: string }[]>`
    insert into documents (course_id, topic_id, kind, title, original_filename, mime_type, size_bytes, sha256)
    values (${courseId}, ${input.topicId ?? null}, ${input.kind}, ${(input.title?.trim() || titleFromFilename(filename)).slice(0, 300)}, ${filename}, ${sniff.mime}, ${input.bytes.length}, ${sha256})
    returning id`;
  await tx`insert into document_blobs (document_id, data) values (${doc!.id}, ${Buffer.from(input.bytes)})`;

  let status: DocumentRow["status"] = "ready";
  let detail: string | null = null;
  let pageCount: number | null = null;
  let charCount = 0;
  try {
    const ex = await extractPages(sniff.kind, input.bytes);
    const chunks = chunkPages(ex.pages);
    pageCount = ex.pages.some((p) => p.page !== null) ? ex.pages.length : null;
    charCount = ex.pages.reduce((n, p) => n + p.text.length, 0);
    if (chunks.length === 0) {
      status = "needs_ocr";
      detail = ex.note ?? "No text could be extracted from this file.";
    } else {
      for (let i = 0; i < chunks.length; i += 200) {
        const batch = chunks.slice(i, i + 200).map((c) => ({ documentId: doc!.id, chunkIndex: c.index, pageNumber: c.page, content: c.content }));
        await tx`insert into document_chunks ${tx(batch as never)}`;
      }
    }
  } catch {
    status = "failed";
    detail = "This file could not be read. It may be corrupted or password-protected.";
  }
  await tx`update documents set status = ${status}, status_detail = ${detail}, page_count = ${pageCount}, char_count = ${charCount} where id = ${doc!.id}`;
  await audit(tx, "document.uploaded", "document", doc!.id, { kind: input.kind, status });
  const [row] = await tx<DocumentRow[]>`select ${cols(tx)} from documents where id = ${doc!.id}`;
  return { document: row!, duplicate: false };
}

export async function listDocuments(tx: Tx, opts: { courseId?: string; kind?: DocumentKind } = {}): Promise<DocumentRow[]> {
  return tx<DocumentRow[]>`
    select ${cols(tx)} from documents where deleted_at is null
      ${opts.courseId ? tx`and course_id = ${opts.courseId}` : tx``} ${opts.kind ? tx`and kind = ${opts.kind}` : tx``}
    order by created_at desc limit 200`;
}

export async function getDocument(tx: Tx, id: string): Promise<DocumentRow> {
  const [d] = await tx<DocumentRow[]>`select ${cols(tx)} from documents where id = ${id} and deleted_at is null`;
  if (!d) throw notFound("Document");
  return d;
}

export async function getDocumentFile(tx: Tx, id: string): Promise<{ doc: DocumentRow; data: Buffer }> {
  const doc = await getDocument(tx, id);
  const [b] = await tx<{ data: Buffer }[]>`select data from document_blobs where document_id = ${id}`;
  if (!b) throw notFound("Document file");
  return { doc, data: b.data };
}

export async function getDocumentText(tx: Tx, id: string): Promise<string> {
  const rows = await tx<{ pageNumber: number | null; content: string }[]>`select page_number, content from document_chunks where document_id = ${id} order by chunk_index`;
  return rows.map((r) => r.content).join("\n");
}

export async function deleteDocument(tx: Tx, id: string) {
  const rows = await tx`update documents set deleted_at = now() where id = ${id} and deleted_at is null returning id`;
  if (rows.length === 0) throw notFound("Document");
  // Free the bytes and index immediately; the row stays as a tombstone for the audit trail.
  await tx`delete from document_blobs where document_id = ${id}`;
  await tx`delete from document_chunks where document_id = ${id}`;
  await audit(tx, "document.deleted", "document", id);
}

export interface Citation {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  kind: DocumentKind;
  page: number | null;
  /** Highlighted excerpt; the matched words are wrapped in «…». */
  snippet: string;
}

/**
 * Keyword retrieval over the user's own materials, returning citations (document + page). Uses PostgreSQL
 * full-text search ('simple' config) — free, no vector DB. Falls back to substring match for scripts without
 * word boundaries (e.g. Chinese). This is the retrieval half of "cited answers"; no model is involved.
 */
export async function searchMaterials(tx: Tx, q: string, opts: { courseId?: string; limit?: number } = {}): Promise<Citation[]> {
  const limit = opts.limit ?? 8;
  const scope = opts.courseId ? tx`and d.course_id = ${opts.courseId}` : tx``;
  const fts = await tx<Citation[]>`
    select c.id as chunk_id, d.id as document_id, d.title as document_title, d.kind, c.page_number as page,
           ts_headline('simple', c.content, query, 'StartSel=«, StopSel=», MaxWords=35, MinWords=12, MaxFragments=1') as snippet
    from document_chunks c join documents d on d.id = c.document_id, websearch_to_tsquery('simple', ${q}) query
    where c.tsv @@ query and d.deleted_at is null ${scope}
    order by ts_rank(c.tsv, query) desc, c.chunk_index limit ${limit}`;
  if (fts.length > 0) return fts;
  return tx<Citation[]>`
    select c.id as chunk_id, d.id as document_id, d.title as document_title, d.kind, c.page_number as page, left(c.content, 220) as snippet
    from document_chunks c join documents d on d.id = c.document_id
    where c.content ilike ${likePattern(q)} and d.deleted_at is null ${scope} order by c.chunk_index limit ${limit}`;
}
