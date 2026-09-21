/** تجميع عدة صور في قالب واحد — كل العمل يتم داخل المتصفح */

export type Cell = { x: number; y: number; w: number; h: number };

export type CollageTemplate = {
  id: string;
  name: string;
  cells: Cell[];
};

export const COLLAGE_TEMPLATES: CollageTemplate[] = [
  { id: "single", name: "صورة واحدة", cells: [{ x: 0, y: 0, w: 1, h: 1 }] },
  {
    id: "cols-2",
    name: "عمودان",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "rows-2",
    name: "صفّان",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: "grid-2x2",
    name: "شبكة ٢×٢",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "rows-3",
    name: "ثلاثة صفوف",
    cells: [
      { x: 0, y: 0, w: 1, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3 },
    ],
  },
  {
    id: "cols-3",
    name: "ثلاثة أعمدة",
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    id: "big-right-2",
    name: "صورة كبيرة + صورتان",
    cells: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
  {
    id: "big-top-3",
    name: "صورة أعلى + ثلاث",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.58 },
      { x: 0, y: 0.58, w: 1 / 3, h: 0.42 },
      { x: 1 / 3, y: 0.58, w: 1 / 3, h: 0.42 },
      { x: 2 / 3, y: 0.58, w: 1 / 3, h: 0.42 },
    ],
  },
  {
    id: "grid-2x3",
    name: "شبكة ٢×٣",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 0, w: 0.5, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 1 / 3, w: 0.5, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 2 / 3, w: 0.5, h: 1 / 3 },
    ],
  },
  {
    id: "grid-3x3",
    name: "شبكة ٣×٣",
    cells: Array.from({ length: 9 }, (_, i) => ({
      x: (i % 3) / 3,
      y: Math.floor(i / 3) / 3,
      w: 1 / 3,
      h: 1 / 3,
    })),
  },
];

export const RATIOS = [
  { id: "1-1", name: "مربع ١:١", value: 1 },
  { id: "4-5", name: "٤:٥ (إنستغرام)", value: 4 / 5 },
  { id: "3-4", name: "٣:٤", value: 3 / 4 },
  { id: "16-9", name: "١٦:٩ عريض", value: 16 / 9 },
  { id: "a4-p", name: "A4 طولي", value: 210 / 297 },
  { id: "a4-l", name: "A4 عرضي", value: 297 / 210 },
] as const;

export const QUALITIES = [
  { id: "hd", name: "عالية — 2000 بكسل", width: 2000 },
  { id: "print", name: "طباعة — 3000 بكسل", width: 3000 },
  { id: "ultra", name: "فائقة — 4500 بكسل", width: 4500 },
  { id: "max", name: "أقصى دقة — 6000 بكسل", width: 6000 },
] as const;

export type Fit = "cover" | "contain";
export type Anchor = "center" | "top" | "bottom" | "start" | "end";

export type CollageItem = {
  id: string;
  name: string;
  image: HTMLImageElement;
  fit: Fit;
  anchor: Anchor;
  zoom: number;
};

export type CollageOptions = {
  width: number;
  ratio: number;
  template: CollageTemplate;
  items: CollageItem[];
  gap: number; // نسبة من العرض
  padding: number; // نسبة من العرض
  radius: number; // نسبة من العرض
  background: string;
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

export function renderCollage(canvas: HTMLCanvasElement, options: CollageOptions) {
  const { width, ratio, template, items, gap, padding, radius, background } = options;
  const height = Math.round(width / ratio);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const pad = padding * width;
  const gapPx = gap * width;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  template.cells.forEach((cell, index) => {
    const item = items[index];
    const x = pad + cell.x * innerW + gapPx / 2;
    const y = pad + cell.y * innerH + gapPx / 2;
    const w = cell.w * innerW - gapPx;
    const h = cell.h * innerH - gapPx;
    if (w <= 0 || h <= 0) return;

    ctx.save();
    roundRect(ctx, x, y, w, h, radius * width);
    ctx.clip();

    if (!item) {
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      return;
    }

    ctx.fillStyle = background;
    ctx.fillRect(x, y, w, h);

    const iw = item.image.naturalWidth || item.image.width;
    const ih = item.image.naturalHeight || item.image.height;
    const base = item.fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
    const scale = base * item.zoom;
    const dw = iw * scale;
    const dh = ih * scale;

    let dx = x + (w - dw) / 2;
    let dy = y + (h - dh) / 2;
    if (item.anchor === "top") dy = y;
    if (item.anchor === "bottom") dy = y + h - dh;
    if (item.anchor === "start") dx = x + w - dw; // يمين (بداية القراءة بالعربية)
    if (item.anchor === "end") dx = x;

    ctx.drawImage(item.image, dx, dy, dw, dh);
    ctx.restore();
  });
}
