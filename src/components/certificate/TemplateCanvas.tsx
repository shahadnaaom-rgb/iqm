import { useEffect, useRef, useState } from "react";

import { certificateTextBounds, drawCertificate, fieldValue, imageHeight, type CertificateImage, type Field } from "../../lib/certificate";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

type Props = {
  image: HTMLImageElement;
  fields: Field[];
  images?: CertificateImage[];
  row?: Record<string, string> | undefined;
  selectedId?: string | null | undefined;
  onSelect?: ((id: string) => void) | undefined;
  onMove?: ((id: string, x: number, y: number) => void) | undefined;
  className?: string | undefined;
};

/** معاينة مباشرة: الرسم والتصدير مشتركان، وصناديق التحديد تحيط بالنص والصور. */
export function TemplateCanvas({
  image,
  fields,
  images = [],
  row,
  selectedId,
  onSelect,
  onMove,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null);
  const [rendered, setRendered] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const raf = requestAnimationFrame(() => {
      drawCertificate(canvas, image, fields, row, 1, images);
      setRendered((value) => value + 1);
    });
    return () => cancelAnimationFrame(raf);
  }, [image, fields, images, row]);

  const handlePointer = (event: React.PointerEvent) => {
    const drag = dragging.current;
    const box = boxRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !box || !onMove) return;
    const rect = box.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width - drag.dx));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height - drag.dy));
    onMove(drag.id, x, y);
  };

  const startDrag = (event: React.PointerEvent, id: string, x: number, y: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = {
      id, pointerId: event.pointerId,
      dx: (event.clientX - rect.left) / rect.width - x,
      dy: (event.clientY - rect.top) / rect.height - y,
    };
    onSelect?.(id);
  };

  const textBounds = (field: Field) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !rendered) return { left: 0, top: 0, width: 0, height: 0 };
    const text = fieldValue(field, row);
    ctx.save();
    const bounds = certificateTextBounds(ctx, field, text, canvas.width, canvas.height);
    ctx.restore();
    // Add a small touch target without changing the anchor used by the canvas.
    const padX = 8 / canvas.getBoundingClientRect().width * canvas.width;
    const padY = 8 / canvas.getBoundingClientRect().height * canvas.height;
    return {
      left: (bounds.left - padX) / canvas.width * 100,
      top: (bounds.top - padY) / canvas.height * 100,
      width: (Math.max(bounds.width, 1) + padX * 2) / canvas.width * 100,
      height: (Math.max(bounds.height, 1) + padY * 2) / canvas.height * 100,
    };
  };

  const canvasRatio = image.naturalWidth / image.naturalHeight;

  return (
    <div
      ref={boxRef}
      className={cn("checker relative w-full overflow-hidden rounded-xl border border-border", className)}
      onPointerMove={handlePointer}
      onPointerUp={() => (dragging.current = null)}
      onPointerCancel={() => (dragging.current = null)}
    >
      <canvas ref={canvasRef} className="block h-auto w-full" />
      {onMove &&
        fields.map((field) => {
          const bounds = textBounds(field);
          return <Button
            key={field.id}
            type="button"
            variant="ghost"
            onPointerDown={(e) => startDrag(e, field.id, field.x, field.y)}
            style={{
              left: `${field.x * 100 + bounds.left}%`,
              top: `${field.y * 100 + bounds.top}%`,
              width: `${bounds.width}%`,
              height: `${bounds.height}%`,
              transformOrigin: `${-bounds.left / bounds.width * 100}% ${-bounds.top / bounds.height * 100}%`,
              transform: `rotate(${field.rotation}deg)`,
            }}
            className={cn(
              "absolute touch-none cursor-move rounded-sm border-2 border-dashed border-transparent p-0 transition-colors",
              selectedId === field.id
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50 hover:bg-primary/5",
            )}
            aria-label={`تحريك حقل ${field.key}`}
          >
            {selectedId === field.id && (
              <span className="absolute -top-6 right-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                {field.key}
              </span>
            )}
          </Button>;
        })}
      {onMove && images.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="ghost"
          onPointerDown={(event) => startDrag(event, item.id, item.x, item.y)}
          style={{
            left: `${item.x * 100}%`, top: `${item.y * 100}%`,
            width: `${item.width * 100}%`, height: `${imageHeight(item, canvasRatio) * 100}%`,
            transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
          }}
          className={cn("absolute min-h-7 min-w-7 touch-none cursor-move rounded-sm border-2 border-dashed border-transparent p-0", selectedId === item.id ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-primary/5")}
          aria-label={`تحريك صورة ${item.name}`}
        >
          {selectedId === item.id && <span className="absolute -top-6 right-0 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{item.name}</span>}
        </Button>
      ))}
    </div>
  );
}
