export interface PageText {
  /** 1-based page number, or null for formats that have no pages. */
  page: number | null;
  text: string;
}

export interface Chunk {
  index: number;
  page: number | null;
  content: string;
}

const norm = (s: string) => s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

/**
 * Split extracted pages into overlapping chunks for retrieval. Chunks never cross a page boundary, so every
 * chunk can be cited with an exact page. Splits prefer paragraph, then sentence, then word boundaries.
 */
export function chunkPages(pages: PageText[], size = 1000, overlap = 150): Chunk[] {
  const chunks: Chunk[] = [];
  for (const p of pages) {
    const text = norm(p.text);
    if (!text) continue;
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + size, text.length);
      if (end < text.length) {
        const window = text.slice(start, end);
        const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"), window.lastIndexOf(" "));
        if (cut > size * 0.5) end = start + cut + 1;
      }
      const content = text.slice(start, end).trim();
      if (content) chunks.push({ index: chunks.length, page: p.page, content });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return chunks;
}
