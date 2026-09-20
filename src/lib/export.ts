/** إعدادات دقة التصدير المشتركة بين كل الأدوات */

export type ExportScaleId = "1x" | "2x" | "3x" | "print";

export const EXPORT_SCALES: {
  id: ExportScaleId;
  label: string;
  scale: number;
  hint?: string;
}[] = [
  { id: "1x", label: "عادية (1x)", scale: 1, hint: "أصغر حجم ملف" },
  { id: "2x", label: "عالية (2x)", scale: 2, hint: "الأفضل للاستخدام العام" },
  { id: "3x", label: "فائقة (3x)", scale: 3, hint: "ملفات كبيرة" },
  { id: "print", label: "طباعة 300DPI", scale: 300 / 96, hint: "جودة الطباعة" },
];

export const DEFAULT_SCALE: ExportScaleId = "2x";

export function scaleOf(id: ExportScaleId) {
  return EXPORT_SCALES.find((s) => s.id === id)?.scale ?? 2;
}

export function isHeavyScale(id: ExportScaleId) {
  return scaleOf(id) > 2.5;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality = 0.95) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("تعذر إنشاء الصورة"))),
      type,
      quality,
    );
  });
}

/** يحوّل عنصر HTML إلى Canvas بالدقة المطلوبة (بعد التأكد من تحميل الخطوط) */
export async function renderNodeToCanvas(node: HTMLElement, scale: number) {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
  const { default: html2canvas } = await import("html2canvas-pro");
  return html2canvas(node, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
}

export async function renderNodeToBlob(
  node: HTMLElement,
  scale: number,
  type: "image/png" | "image/jpeg" = "image/png",
) {
  const canvas = await renderNodeToCanvas(node, scale);
  return canvasToBlob(canvas, type, type === "image/jpeg" ? 0.95 : 1);
}
