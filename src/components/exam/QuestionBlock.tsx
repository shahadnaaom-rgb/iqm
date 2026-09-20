import { useEffect, useRef } from "react";
import { GripVertical, Lock } from "lucide-react";

import { clamp, questionLabel, type Block } from "../../lib/exam";
import { cn } from "../../lib/utils";

type Props = {
  block: Block;
  number?: number | undefined;
  selected: boolean;
  exporting: boolean;
  getRect: () => DOMRect | null;
  onSelect: () => void;
  onChange: (patch: Partial<Block>) => void;
};

export function QuestionBlock({
  block,
  number,
  selected,
  exporting,
  getRect,
  onSelect,
  onChange,
}: Props) {
  const editable = useRef<HTMLDivElement | null>(null);

  // تحديث محتوى النص من الخارج فقط (الرموز، إعادة التعيين) لتجنّب قطع الكتابة
  useEffect(() => {
    const el = editable.current;
    if (!el) return;
    if (el.innerHTML !== block.html && document.activeElement !== el) {
      el.innerHTML = block.html;
    }
  }, [block.html]);

  function startDrag(e: React.PointerEvent) {
    if (block.locked) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const rect = getRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = block.x;
    const originY = block.y;

    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      onChange({
        x: clamp(originX + dx, -2, 100 - 5),
        y: clamp(originY + dy, -2, 100 - 2),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = getRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const originW = block.w;
    const originH = block.h;

    const move = (ev: PointerEvent) => {
      const dx = ((startX - ev.clientX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      const patch: Partial<Block> = { w: clamp(originW + dx, 8, 100) };
      if (block.type === "image") patch.h = clamp(originH + dy, 4, 100);
      onChange(patch);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const style: React.CSSProperties = {
    position: "absolute",
    right: `${block.x}%`,
    top: `${block.y}%`,
    width: `${block.w}%`,
    fontFamily: `"${block.fontFamily}", Cairo, sans-serif`,
    fontSize: `${block.fontSize}px`,
    lineHeight: block.lineHeight,
    color: block.color,
    fontWeight: block.bold ? 700 : 400,
    fontStyle: block.italic ? "italic" : "normal",
    textDecoration: block.underline ? "underline" : "none",
    textAlign: block.align,
  };

  return (
    <div
      style={style}
      onPointerDown={() => onSelect()}
      className={cn(
        "group",
        !exporting && "rounded-md outline-offset-2 transition-shadow",
        !exporting && selected && "outline outline-2 outline-primary",
        !exporting && !selected && "hover:outline hover:outline-1 hover:outline-primary/40",
      )}
    >
      {block.type === "image" ? (
        <img
          src={block.src}
          alt=""
          draggable={false}
          onPointerDown={startDrag}
          style={{ width: "100%", height: `${block.h}%`, objectFit: "contain" }}
          className="pointer-events-auto select-none"
        />
      ) : (
        <div className="flex items-start gap-2">
          {block.type === "question" && block.numbered && number ? (
            <span className="shrink-0 font-bold" onPointerDown={startDrag}>
              {questionLabel(number)}
            </span>
          ) : null}
          <div
            ref={editable}
            contentEditable={!block.locked && !exporting}
            suppressContentEditableWarning
            dir="rtl"
            onInput={(e) => onChange({ html: (e.target as HTMLDivElement).innerHTML })}
            onBlur={(e) => onChange({ html: (e.target as HTMLDivElement).innerHTML })}
            className="min-w-0 flex-1 outline-none"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        </div>
      )}

      {!exporting && selected && (
        <>
          <button
            type="button"
            aria-label="سحب"
            onPointerDown={startDrag}
            className="absolute -top-3 right-0 flex size-6 cursor-grab items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            {block.locked ? <Lock className="size-3.5" /> : <GripVertical className="size-3.5" />}
          </button>
          <button
            type="button"
            aria-label="تغيير الحجم"
            onPointerDown={startResize}
            className="absolute -bottom-2 -left-2 size-4 cursor-nwse-resize rounded-sm border-2 border-primary bg-background"
          />
        </>
      )}
    </div>
  );
}
