// Reading PDFs in the browser, shared by the flashcard importer and the question writer.
// Text PDFs are read locally and only their text is sent on; scanned PDFs (no text layer) are sent whole.

export const SCANNED_MAX_BYTES = 3_000_000; // must fit the platform's 4.5 MB request limit once base64-encoded

export async function readPdf(file: File) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { totalPages, pages: text.map((t) => t.replace(/\s+/g, " ").trim()) };
}

/** True when the chosen pages have almost no extractable text, i.e. the PDF is scanned images. */
export const looksScanned = (pages: string[]) => pages.reduce((n, p) => n + p.length, 0) < 80 * pages.length;

/** Groups pages into chunks of about `maxChars`, tagging each page so the model can cite where facts came from. */
export function chunkPages(pages: string[], firstPage: number, maxChars: number) {
  const chunks: string[] = [];
  let buf = "";
  pages.forEach((p, i) => {
    const page = `[Page ${firstPage + i}] ${p}\n`;
    if (buf.length + page.length > maxChars && buf) {
      chunks.push(buf);
      buf = "";
    }
    buf += page;
  });
  if (buf) chunks.push(buf);
  return chunks;
}

/** Clamps an optional 1-based page range to the document. */
export function pageRange(totalPages: number, from: string, to: string) {
  const a = Math.max(1, Math.min(totalPages, Number(from) || 1));
  const b = Math.max(a, Math.min(totalPages, Number(to) || totalPages));
  return { a, b };
}

export function toBase64(buf: ArrayBuffer) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

export const fileSize = (bytes: number) => (bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`);
