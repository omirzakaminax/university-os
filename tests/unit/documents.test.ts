import { describe, expect, it } from "vitest";
import { chunkPages } from "@/domain/documents/chunk";
import { MAX_UPLOAD_BYTES, sanitizeFilename, sniffFile, titleFromFilename } from "@/domain/documents/validate";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("chunking", () => {
  it("keeps chunks within size, preserves page numbers and never crosses pages", () => {
    const page1 = "Alpha sentence. ".repeat(200);
    const chunks = chunkPages([{ page: 1, text: page1 }, { page: 2, text: "Short second page." }], 500, 80);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.content.length <= 500)).toBe(true);
    expect(chunks.filter((c) => c.page === 2)).toHaveLength(1);
    expect(chunks.at(-1)!.content).toBe("Short second page.");
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });
  it("skips empty pages and overlaps consecutive chunks", () => {
    expect(chunkPages([{ page: 1, text: "   \n  " }])).toEqual([]);
    const text = Array.from({ length: 60 }, (_, i) => `Word${i}`).join(" ");
    const [a, b] = chunkPages([{ page: null, text }], 120, 40);
    const tail = a!.content.split(" ").slice(-2).join(" ");
    expect(b!.content).toContain(tail);
  });
  it("terminates on text without any break points", () => {
    expect(chunkPages([{ page: null, text: "x".repeat(5000) }], 1000, 100).length).toBeGreaterThan(4);
  });
});

describe("upload validation (content sniffing, not extensions)", () => {
  it("accepts real PDF / DOCX / text / images by magic bytes", () => {
    expect(sniffFile("a.pdf", bytes("%PDF-1.7 ..."))).toMatchObject({ ok: true, kind: "pdf" });
    expect(sniffFile("a.docx", new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).toMatchObject({ ok: true, kind: "docx" });
    expect(sniffFile("a.md", bytes("# Title\nbody"))).toMatchObject({ ok: true, kind: "markdown" });
    expect(sniffFile("a.txt", bytes("Привет, мир"))).toMatchObject({ ok: true, kind: "text" });
    expect(sniffFile("a.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0]))).toMatchObject({ ok: true, kind: "image" });
    expect(sniffFile("a.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ ok: true, kind: "image" });
  });
  it("rejects disguised, binary, empty, oversized and unknown files", () => {
    expect(sniffFile("evil.pdf", bytes("MZ\u0090\u0000 executable"))).toMatchObject({ ok: false });
    expect(sniffFile("notes.txt", new Uint8Array([0x4d, 0x5a, 0, 0, 1, 2]))).toMatchObject({ ok: false });
    expect(sniffFile("a.zip", new Uint8Array([0x50, 0x4b, 3, 4]))).toMatchObject({ ok: false });
    expect(sniffFile("a.pdf", new Uint8Array())).toMatchObject({ ok: false });
    expect(sniffFile("a.pdf", new Uint8Array(MAX_UPLOAD_BYTES + 1))).toMatchObject({ ok: false });
    expect(sniffFile("a.exe", bytes("hello"))).toMatchObject({ ok: false });
  });
  it("sanitises filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\x\\y\\report?.pdf")).toBe("report.pdf");
    expect(sanitizeFilename("..hidden")).toBe("hidden");
    expect(sanitizeFilename("\u0000\u0001")).toBe("file");
    expect(titleFromFilename("Calculus_II-syllabus.2026.pdf")).toBe("Calculus II syllabus.2026");
  });
});
