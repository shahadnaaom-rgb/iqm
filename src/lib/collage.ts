/** قوالب تجميع الصور — الرسم يتم على Canvas مباشرة لأعلى دقة */

export type Cell = { x: number; y: number; w: number; h: number };

export type CollageTemplate = {
  id: string;
  label: string;
  cells: Cell[];
};

export const COLLAGE_TEMPLATES: CollageTemplate[] = [
  { id: "1", label: "صورة واحدة", cells: [{ x: 0, y: 0, w: 1, h: 1 }] },
  {
    id: "2h",
    label: "صورتان جانبيتان",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "2v",
    label: "صورتان فوق بعض",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: "3v",
    label: "ثلاث صور طولية",
    cells: [
      { x: 0, y: 0, w: 1, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ],
  },
  {
    id: "1+2",
    label: "صورة كبيرة + صورتان",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.6 },
      { x: 0, y: 0.6, w: 0.5, h: 0.4 },
      { x: 0.5, y: 0.6, w: 0.5, h: 0.4 },
    ],
  },
  {
    id: "2x2",
    label: "شبكة 2×2",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "1+3",
    label: "صورة يمين + ثلاث يسار",
    cells: [
      { x: 0, y: 0, w: 0.6, h: 1 },
      { x: 0.6, y: 0, w: 0.4, h: 1 / 3 },
      { x: 0.6, y: 1 / 3, w: 0.4, h: 1 / 3 },
      { x: 0.6, y: 2 / 3, w: 0.4, h: 1 / 3 },
    ],
  },
  { id: "3x3", label: "شبكة 3×3", cells: grid(3, 3) },
  { id: "4x2", label: "شبكة 4×2", cells: grid(4, 2) },
];

function grid(cols: number, rows: number): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows });
    }
  }
  return cells;
}

export type SizePreset = {
  id: string;
  label: string;
  w: number;
  h: number;
};

/** المقاسات بالبكسل عند الدقة العادية (1x) */
export const SIZE_PRESETS: SizePreset[] = [
  { id: "square", label: "مربع 1:1", w: 1080, h: 1080 },
  { id: "a4p", label: "A4 طولي", w: 794, h: 1123 },
  { id: "a4l", label: "A4 عرضي", w: 1123, h: 794 },
  { id: "wide", label: "عريض 16:9", w: 1280, h: 720 },
  { id: "story", label: "ستوري 9:16", w: 1080, h: 1920 },
  { id: "post", label: "منشور 4:5", w: 1080, h: 1350 },
];

export type Fit = "cover" | "contain";

export type Slot = {
  id: string;
  src: string;
  img?: HTMLImageElement;
  /** إزاحة الصورة داخل الخانة بالنسبة المئوية */
  offsetX: number;
  offsetY: number;
  zoom: number;
  fit: Fit;
};

export type CollageOptions = {
  width: number;
  height: number;
  gap: number;
  padding: number;
  radius: number;
  background: string;
  borderWidth: number;
  borderColor: string;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawCollage(
  canvas: HTMLCanvasElement,
  template: CollageTemplate,
  slots: (Slot | undefined)[],
  options: CollageOptions,
  scale = 1,
) {
  const W = Math.round(options.width * scale);
  const H = Math.round(options.height * scale);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, W, H);

  const pad = options.padding * scale;
  const gap = options.gap * scale;
  const areaW = W - pad * 2;
  const areaH = H - pad * 2;

  template.cells.forEach((cell, i) => {
    const cx = pad + cell.x * areaW + gap / 2;
    const cy = pad + cell.y * areaH + gap / 2;
    const cw = cell.w * areaW - gap;
    const ch = cell.h * areaH - gap;
    if (cw <= 0 || ch <= 0) return;

    const slot = slots[i];
    ctx.save();
    roundRect(ctx, cx, cy, cw, ch, options.radius * scale);
    ctx.clip();

    if (slot?.img) {
      const img = slot.img;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const base =
        slot.fit === "cover" ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih);
      const drawW = iw * base * slot.zoom;
      const drawH = ih * base * slot.zoom;
      const dx = cx + (cw - drawW) / 2 + (slot.offsetX / 100) * cw;
      const dy = cy + (ch - drawH) / 2 + (slot.offsetY / 100) * ch;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(cx, cy, cw, ch);
    }
    ctx.restore();

    if (options.borderWidth > 0) {
      ctx.save();
      roundRect(ctx, cx, cy, cw, ch, options.radius * scale);
      ctx.lineWidth = options.borderWidth * scale;
      ctx.strokeStyle = options.borderColor;
      ctx.stroke();
      ctx.restore();
    }
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    img.src = src;
  });
}
