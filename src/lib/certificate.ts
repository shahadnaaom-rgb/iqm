export type Align = "right" | "center" | "left";

export type CertificateImage = {
  id: string;
  image: HTMLImageElement;
  name: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
};

export function imageHeight(item: CertificateImage, canvasRatio: number) {
  return item.width * (item.image.naturalHeight / item.image.naturalWidth) * canvasRatio;
}

export type Field = {
  id: string;
  /** اسم الحقل، ويُستخدم كمفتاح ربط مع أعمدة Excel */
  key: string;
  /** النص الظاهر في وضع الشهادة الواحدة أو نص المعاينة */
  text: string;
  /** نسبة من عرض/ارتفاع القالب (0..1) */
  x: number;
  y: number;
  /** نسبة من ارتفاع القالب */
  fontSize: number;
  /** نسبة من عرض القالب: أقصى عرض للنص */
  maxWidth: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  align: Align;
  rotation: number;
  letterSpacing: number;
  /** ترقيم تلقائي: ينشئ نسخة لكل رقم ضمن المدى، مع تضمين الطرفين */
  autoNumber?: { start: number; end: number; pad: number; prefix: string } | undefined;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newField(partial: Partial<Field> = {}): Field {
  return {
    id: uid(),
    key: "الاسم",
    text: "أحمد محمد",
    x: 0.5,
    y: 0.5,
    fontSize: 0.07,
    maxWidth: 0.8,
    fontFamily: "Cairo",
    color: "#1a3b47",
    bold: true,
    align: "center",
    rotation: 0,
    letterSpacing: 0,
    ...partial,
  };
}

export function fieldValue(field: Field, row?: Record<string, string>) {
  if (field.autoNumber) {
    const { start, pad, prefix } = field.autoNumber;
    const idx = Number(row?.["__index"] ?? 0) || 0;
    return `${prefix}${String(start + idx).padStart(pad, "0")}`;
  }
  if (!row) return field.text;
  const value = row[field.key];
  return value !== undefined && value !== "" ? String(value) : field.text;
}

export function autoNumberCount(field?: Field) {
  if (!field?.autoNumber) return 1;
  return Math.max(1, field.autoNumber.end - field.autoNumber.start + 1);
}

/** قياسات النص من نفس إعدادات الرسم، لتطابق حدود التحريك مع النص المرسوم. */
export function certificateTextBounds(
  ctx: CanvasRenderingContext2D,
  field: Field,
  text: string,
  width: number,
  height: number,
) {
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.textAlign = field.align;
  let size = field.fontSize * height;
  for (let i = 0; i < 40; i++) {
    ctx.font = `${field.bold ? "700" : "400"} ${size}px "${field.fontFamily}", "Cairo", sans-serif`;
    ctx.letterSpacing = `${field.letterSpacing * size}px`;
    if (ctx.measureText(text).width <= field.maxWidth * width || size <= 8) break;
    size -= Math.max(1, size * 0.04);
  }
  const metrics = ctx.measureText(text);
  return {
    left: -metrics.actualBoundingBoxLeft,
    top: -metrics.actualBoundingBoxAscent,
    width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
    height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
  };
}

/** يرسم القالب والحقول على Canvas بأبعاد الصورة الأصلية */
export function drawCertificate(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | ImageBitmap,
  fields: Field[],
  row?: Record<string, string>,
  scale = 1,
  images: CertificateImage[] = [],
) {
  const baseW = "naturalWidth" in image ? image.naturalWidth : image.width;
  const baseH = "naturalHeight" in image ? image.naturalHeight : image.height;
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image as CanvasImageSource, 0, 0, w, h);
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";

  for (const field of fields) {
    const text = fieldValue(field, row);
    if (!text) continue;
    ctx.save();
    ctx.translate(field.x * w, field.y * h);
    ctx.rotate((field.rotation * Math.PI) / 180);
    ctx.fillStyle = field.color;
    certificateTextBounds(ctx, field, text, w, h);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  for (const item of images) {
    const imageWidth = item.width * w;
    const imageHeight = imageWidth * item.image.naturalHeight / item.image.naturalWidth;
    ctx.save();
    ctx.translate(item.x * w, item.y * h);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.drawImage(item.image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
    ctx.restore();
  }
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذر قراءة الصورة"));
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("تعذر إنشاء الصورة"))),
      type,
      quality,
    );
  });
}

export function safeFileName(name: string) {
  return (name || "شهادة").replace(/[\\/:*?"<>|]/g, "_").trim();
}
