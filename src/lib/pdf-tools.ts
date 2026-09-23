/** أدوات PDF داخل المتصفح فقط: pdf-lib للتحرير و pdf.js للمعاينة والتحويل */
import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    })();
  }
  return pdfjsPromise;
}

export async function loadPdf(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  return lib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
}

export async function renderPage(
  doc: PDFDocumentProxy,
  index: number,
  scale: number,
  rotation = 0,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(index + 1);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** تحويل صورة إلى ملف PDF من صفحة واحدة بمقاس الصورة أو A4 */
export async function imageToPdfBytes(file: File, fit: "image" | "a4"): Promise<ArrayBuffer> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  let bytes = await file.arrayBuffer();
  let isPng = file.type === "image/png";
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    const bmp = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    bytes = await blob.arrayBuffer();
    isPng = true;
  }
  const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  if (fit === "image") {
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  } else {
    const landscape = img.width > img.height;
    const [W, H] = landscape ? [841.89, 595.28] : [595.28, 841.89];
    const page = doc.addPage([W, H]);
    const m = 24;
    const s = Math.min((W - m * 2) / img.width, (H - m * 2) / img.height);
    const w = img.width * s;
    const h = img.height * s;
    page.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
  }
  const out = await doc.save();
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

export type PageRef = { src: number; index: number; rotation: number };

export async function buildPdf(sources: ArrayBuffer[], pages: PageRef[]): Promise<Blob> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const loaded = new Map<number, Awaited<ReturnType<typeof PDFDocument.load>>>();
  for (const p of pages) {
    let d = loaded.get(p.src);
    if (!d) {
      d = await PDFDocument.load(sources[p.src], { ignoreEncryption: true });
      loaded.set(p.src, d);
    }
    const [copied] = await out.copyPages(d, [p.index]);
    if (p.rotation) copied.setRotation(degrees((copied.getRotation().angle + p.rotation) % 360));
    out.addPage(copied);
  }
  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
