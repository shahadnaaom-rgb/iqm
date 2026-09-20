import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Copy,
  Italic,
  Lock,
  LockOpen,
  Trash2,
  Underline,
} from "lucide-react";

import type { Block, BlockAlign } from "../../lib/exam";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

type Props = {
  block: Block;
  families: { family: string; label: string }[];
  onChange: (patch: Partial<Block>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

const ALIGNS: { v: BlockAlign; Icon: typeof AlignLeft; label: string }[] = [
  { v: "right", Icon: AlignRight, label: "يمين" },
  { v: "center", Icon: AlignCenter, label: "وسط" },
  { v: "left", Icon: AlignLeft, label: "يسار" },
  { v: "justify", Icon: AlignJustify, label: "ضبط" },
];

export function BlockToolbar({ block, families, onChange, onDuplicate, onRemove }: Props) {
  const isText = block.type !== "image";

  return (
    <div className="surface sticky top-20 z-20 grid gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold">
          {block.type === "image" ? "صورة محدّدة" : block.type === "question" ? "سؤال محدّد" : "نص محدّد"}
        </h2>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onDuplicate} aria-label="نسخ">
            <Copy className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={block.locked ? "default" : "ghost"}
            onClick={() => onChange({ locked: !block.locked })}
            aria-label="قفل الموضع"
          >
            {block.locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove} aria-label="حذف">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      {isText && (
        <>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="icon"
              variant={block.bold ? "default" : "outline"}
              onClick={() => onChange({ bold: !block.bold })}
              aria-label="عريض"
            >
              <Bold className="size-4" />
            </Button>
            <Button
              size="icon"
              variant={block.italic ? "default" : "outline"}
              onClick={() => onChange({ italic: !block.italic })}
              aria-label="مائل"
            >
              <Italic className="size-4" />
            </Button>
            <Button
              size="icon"
              variant={block.underline ? "default" : "outline"}
              onClick={() => onChange({ underline: !block.underline })}
              aria-label="تحت خط"
            >
              <Underline className="size-4" />
            </Button>
            <span className="mx-1 h-6 w-px bg-border" />
            {ALIGNS.map(({ v, Icon, label }) => (
              <Button
                key={v}
                size="icon"
                variant={block.align === v ? "default" : "outline"}
                onClick={() => onChange({ align: v })}
                aria-label={`محاذاة ${label}`}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>

          <div className="grid gap-2">
            <Label>الخط (نفس خطوط الشهادات)</Label>
            <select
              value={block.fontFamily}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              style={{ fontFamily: `"${block.fontFamily}", Cairo, sans-serif` }}
            >
              {families.map((f) => (
                <option key={f.family} value={f.family} style={{ fontFamily: `"${f.family}"` }}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>حجم الخط: {block.fontSize}px</Label>
              <input
                type="range"
                min={9}
                max={48}
                value={block.fontSize}
                onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-1">
              <Label>تباعد الأسطر: {block.lineHeight.toFixed(1)}</Label>
              <input
                type="range"
                min={10}
                max={30}
                value={block.lineHeight * 10}
                onChange={(e) => onChange({ lineHeight: Number(e.target.value) / 10 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>اللون</Label>
              <input
                type="color"
                value={block.color}
                onChange={(e) => onChange({ color: e.target.value })}
                className="h-10 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
              />
            </div>
            {block.type === "question" && (
              <div className="grid gap-1">
                <Label>الترقيم التلقائي</Label>
                <Button
                  variant={block.numbered ? "default" : "outline"}
                  onClick={() => onChange({ numbered: !block.numbered })}
                >
                  {block.numbered ? "مُرقّم (س١، س٢)" : "بدون ترقيم"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label>العرض: {Math.round(block.w)}%</Label>
          <input
            type="range"
            min={8}
            max={100}
            value={block.w}
            onChange={(e) => onChange({ w: Number(e.target.value) })}
          />
        </div>
        {block.type === "image" && (
          <div className="grid gap-1">
            <Label>الارتفاع: {Math.round(block.h)}%</Label>
            <input
              type="range"
              min={4}
              max={100}
              value={block.h}
              onChange={(e) => onChange({ h: Number(e.target.value) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
