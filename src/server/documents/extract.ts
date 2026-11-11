import type { PageText } from "@/domain/documents/chunk";
import type { FileKind } from "@/domain/documents/validate";

export interface Extraction {
  pages: PageText[];
  /** Why no text could be produced (e.g. scanned PDF, image) — surfaced to the user, never hidden. */
  note?: string;
}

/**
 * Text extraction. Runs entirely in-process with open-source libraries (unpdf/pdf.js, mammoth): no paid service.
 * Files are parsed, never executed; images are stored but need OCR/vision (an AI provider) to yield text.
 */
export async function extractPages(kind: FileKind, bytes: Uint8Array): Promise<Extraction> {
  switch (kind) {
    case "text":
    case "markdown":
      return { pages: [{ page: null, text: new TextDecoder("utf-8").decode(bytes) }] };
    case "docx": {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return { pages: [{ page: null, text: r.value }] };
    }
    case "pdf": {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractText(pdf, { mergePages: false });
      const pages = (text as string[]).map((t, i) => ({ page: i + 1, text: t }));
      const total = pages.reduce((n, p) => n + p.text.trim().length, 0);
      if (total < 20) return { pages: [], note: "This PDF has no selectable text (it may be a scan). OCR needs an AI provider, which is not configured." };
      return { pages };
    }
    case "image":
      return { pages: [], note: "Images are stored, but reading text from them needs OCR or a vision model (an AI provider), which is not configured." };
  }
}
