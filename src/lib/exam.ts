/** نموذج بلوكات ورقة الأسئلة — كل بلوك عنصر مستقل على صفحة A4 */

export type BlockAlign = "right" | "center" | "left" | "justify";
export type BlockType = "question" | "text" | "image";

export type Block = {
  id: string;
  type: BlockType;
  page: number;
  /** ترتيب الظهور/الترقيم */
  order: number;
  /** النسب المئوية من عرض/ارتفاع منطقة المحتوى */
  x: number;
  y: number;
  w: number;
  /** ارتفاع الصورة بالنسبة المئوية (للصور فقط) */
  h: number;
  html: string;
  src?: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: BlockAlign;
  numbered: boolean;
  locked: boolean;
};

export const A4_W = 794;
export const A4_H = 1123;

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newBlock(partial: Partial<Block> = {}): Block {
  return {
    id: uid(),
    type: "question",
    page: 0,
    order: Date.now(),
    x: 4,
    y: 6,
    w: 92,
    h: 20,
    html: "أجب عن الفرع الآتي: ..................................................",
    fontFamily: "Cairo",
    fontSize: 17,
    lineHeight: 1.9,
    color: "#111827",
    bold: false,
    italic: false,
    underline: false,
    align: "right",
    numbered: true,
    locked: false,
    ...partial,
  };
}

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicDigits(value: number) {
  return String(value)
    .split("")
    .map((c) => AR_DIGITS[Number(c)] ?? c)
    .join("");
}

/** ترتيب البلوكات: حسب الصفحة ثم الترتيب */
export function sortBlocks(blocks: Block[]) {
  return [...blocks].sort((a, b) => a.page - b.page || a.order - b.order);
}

/** ترقيم تلقائي للأسئلة المرقّمة بحسب ترتيبها الحالي */
export function questionNumbers(blocks: Block[]) {
  const map = new Map<string, number>();
  let n = 0;
  for (const b of sortBlocks(blocks)) {
    if (b.type === "question" && b.numbered) {
      n += 1;
      map.set(b.id, n);
    }
  }
  return map;
}

export function questionLabel(n: number) {
  return `س${toArabicDigits(n)}:`;
}

/** تبادل ترتيب بلوك مع البلوك المجاور له في نفس الصفحة */
export function moveBlockOrder(blocks: Block[], id: string, dir: -1 | 1): Block[] {
  const target = blocks.find((b) => b.id === id);
  if (!target) return blocks;
  const siblings = sortBlocks(blocks.filter((b) => b.page === target.page));
  const index = siblings.findIndex((b) => b.id === id);
  const other = siblings[index + dir];
  if (!other) return blocks;
  return blocks.map((b) => {
    if (b.id === target.id) return { ...b, order: other.order };
    if (b.id === other.id) return { ...b, order: target.order };
    return b;
  });
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function safeFileName(name: string) {
  return (name || "ورقة-أسئلة").replace(/[\\/:*?"<>|]/g, "_").trim();
}
