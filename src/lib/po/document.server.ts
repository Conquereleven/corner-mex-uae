import { parseMafPoText } from "./maf-parser.ts";
import { createHash } from "node:crypto";
import { parsePoText, PoError, PoSchema } from "./domain.ts";
export const MAX_PO_BYTES = 5 * 1024 * 1024;
export const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
/** No remote URLs, OCR provider, embedded scripts or external document requests. */
export async function extractPo(bytes: Uint8Array, mime: string, mappings?: unknown) {
  if (!bytes.length || bytes.length > MAX_PO_BYTES) throw new PoError("DOCUMENT_SIZE_INVALID");
  if (mime === "application/json") {
    try {
      return PoSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      throw new PoError("PO_SCHEMA_INVALID");
    }
  }
  if (mime === "text/plain") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return /Purchase Order No\s*:/i.test(text) ? parseMafPoText(text, mappings) : parsePoText(text);
  }
  if (mime !== "application/pdf" || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new PoError("DOCUMENT_TYPE_UNSUPPORTED");
  // Explicit import makes Nitro include the worker module; PDF.js' relative runtime
  // import otherwise points to a missing file in the deployed server bundle.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: true,
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > 20) throw new PoError("DOCUMENT_PAGE_LIMIT");
    let text = "";
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n),
        content = await page.getTextContent();
      for (const item of content.items)
        if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ");
      text += "\n";
      if (text.length > 200_000) throw new PoError("DOCUMENT_TEXT_LIMIT");
    }
    if (!text.trim()) throw new PoError("OCR_REQUIRED");
    return /Purchase Order No\s*:/i.test(text) ? parseMafPoText(text, mappings) : parsePoText(text);
  } catch (e) {
    if (e instanceof PoError) throw e;
    throw new PoError("PDF_UNREADABLE");
  } finally {
    await task.destroy();
  }
}
