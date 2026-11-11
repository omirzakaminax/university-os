/**
 * Upload validation. The extension is a hint only: the file's actual bytes decide what it is
 * ("magic number" sniffing), so a renamed executable cannot pass as a PDF.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type FileKind = "pdf" | "docx" | "text" | "markdown" | "image";

export interface SniffResult {
  ok: true;
  kind: FileKind;
  mime: string;
}
export interface SniffError {
  ok: false;
  reason: string;
}

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

function looksLikeText(b: Uint8Array): boolean {
  const sample = b.subarray(0, Math.min(b.length, 8192));
  for (const byte of sample) if (byte === 0) return false; // NUL bytes never occur in real text
  try {
    // stream:true tolerates a multi-byte character that is cut off at the end of the sample.
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  }
}

export function sniffFile(filename: string, bytes: Uint8Array): SniffResult | SniffError {
  if (bytes.length === 0) return { ok: false, reason: "The file is empty." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "The file is larger than 15 MB." };
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ok: true, kind: "pdf", mime: "application/pdf" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { ok: true, kind: "image", mime: "image/png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ok: true, kind: "image", mime: "image/jpeg" };
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // DOCX is a ZIP container; other ZIP-based formats (xlsx, pptx, jar, apk…) are rejected by extension.
    if (ext === "docx") return { ok: true, kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    return { ok: false, reason: "Only .docx is supported for Word documents. (ZIP-based files of other types are not accepted.)" };
  }
  if (ext === "txt" || ext === "md" || ext === "markdown") {
    if (!looksLikeText(bytes)) return { ok: false, reason: "That file is not valid UTF-8 text." };
    return { ok: true, kind: ext === "txt" ? "text" : "markdown", mime: ext === "txt" ? "text/plain" : "text/markdown" };
  }
  return { ok: false, reason: "Unsupported file type. Upload a PDF, DOCX, TXT, Markdown, PNG or JPEG." };
}

/** Strip any path, control characters and odd whitespace from a client-supplied filename. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, "").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  return (clean || "file").slice(0, 200);
}

export function titleFromFilename(name: string): string {
  return sanitizeFilename(name).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Untitled";
}
