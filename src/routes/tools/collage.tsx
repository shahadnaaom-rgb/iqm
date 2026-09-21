import { createFileRoute } from "@tanstack/react-router";
import { Download, Images, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ExportQuality } from "../../components/ExportQuality";
import { PageHeader } from "../../components/PrivacyNote";
import { UploadZone } from "../../components/UploadZone";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import {
  COLLAGE_TEMPLATES,
  SIZE_PRESETS,
  drawCollage,
  loadImage,
  type CollageOptions,
  type Slot,
} from "../../lib/collage";
import { canvasToBlob, DEFAULT_SCALE, scaleOf, type ExportScaleId } from "../../lib/export";
import { downloadBlob } from "../../lib/save";

export const Route = createFileRoute("/tools/collage")({
  head: () => ({
    meta: [
      { title: "تجميع الصور في قوالب — منصة الأستاذ" },
      {
        name: "description",
        content:
          "اجمع عدة صور في قالب واحد: شبكات جاهزة، محاذاة وتكبير لكل صورة، مسافات وحواف، وتصدير PNG أو JPG بدقة عالية على جهازك.",
      },
      { property: "og:title", content: "تجميع الصور — منصة الأستاذ" },
      {
        property: "og:description",
        content: "قوالب تجميع صور مع تصدير بدقة عالية، والمعالجة كلها داخل متصفحك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollageTool,
});

function CollageTool() {
  const [templateId, setTemplateId] = useState(COLLAGE_TEMPLATES[5]!.id);
  const [sizeId, setSizeId] = useState(SIZE_PRESETS[0]!.id);
  const [customW, setCustomW] = useState(0);
  const [customH, setCustomH] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [active, setActive] = useState(0);
  const [quality, setQuality] = useState<ExportScaleId>(DEFAULT_SCALE);
  const [busy, setBusy] = useState(false);

  const [gap, setGap] = useState(8);
  const [padding, setPadding] = useState(16);
  const [radius, setRadius] = useState(12);
  const [background, setBackground] = useState("#ffffff");
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderColor, setBorderColor] = useState("#1a3b47");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const template = COLLAGE_TEMPLATES.find((t) => t.id === templateId) ?? COLLAGE_TEMPLATES[0]!;
  const preset = SIZE_PRESETS.find((s) => s.id === sizeId) ?? SIZE_PRESETS[0]!;
  const width = customW > 0 ? customW : preset.w;
  const height = customH > 0 ? customH : preset.h;

  const options: CollageOptions = useMemo(
    () => ({ width, height, gap, padding, radius, background, borderWidth, borderColor }),
    [width, height, gap, padding, radius, background, borderWidth, borderColor],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const arranged = template.cells.map((_, i) => slots[i]);
    drawCollage(canvas, template, arranged, options, 1);
  }, [template, slots, options]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const onFiles = async (files: File[]) => {
    try {
      const loaded = await Promise.all(
        files.map(async (file) => {
          const src = URL.createObjectURL(file);
          const img = await loadImage(src);
          const slot: Slot = {
            id: Math.random().toString(36).slice(2, 9),
            src,
            img,
            offsetX: 0,
            offsetY: 0,
            zoom: 1,
            fit: "cover",
          };
          return slot;
        }),
      );
      setSlots((prev) => [...prev, ...loaded]);
      toast.success(`أُضيفت ${loaded.length} صورة على جهازك`);
    } catch {
      toast.error("تعذر قراءة إحدى الصور");
    }
  };

  const patchSlot = (index: number, p: Partial<Slot>) =>
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...p } : s)));

  const moveSlot = (index: number, dir: -1 | 1) =>
    setSlots((prev) => {
      const next = [...prev];
      const target = next[index + dir];
      const current = next[index];
      if (!target || !current) return prev;
      next[index] = target;
      next[index + dir] = current;
      return next;
    });

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
    setActive(0);
  };

  const exportImage = async (type: "image/png" | "image/jpeg") => {
    if (!slots.length) {
      toast.error("أضف صوراً أولاً");
      return;
    }
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      const arranged = template.cells.map((_, i) => slots[i]);
      drawCollage(canvas, template, arranged, options, scaleOf(quality));
      const blob = await canvasToBlob(canvas, type, type === "image/jpeg" ? 0.95 : 1);
      downloadBlob(blob, `تجميع-صور-${canvas.width}x${canvas.height}.${type === "image/png" ? "png" : "jpg"}`);
      toast.success(`تم التصدير بدقة ${canvas.width}×${canvas.height}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التصدير");
    } finally {
      setBusy(false);
    }
  };

  const current = slots[active];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10">
      <PageHeader
        icon={<Images className="size-6" />}
        title="تجميع الصور"
        description="ارفع عدة صور، اختر القالب والمقاس، اضبط محاذاة كل صورة، ثم صدّر النتيجة بدقة عالية — كل شيء على جهازك."
      />

      <UploadZone
        accept="image/*"
        multiple
        title="ارفع الصور (يمكن اختيار عدة صور)"
        hint="PNG · JPG · WebP"
        onFiles={onFiles}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-3">
          <div className="surface grid place-items-center overflow-hidden p-3">
            <canvas
              ref={canvasRef}
              className="max-h-[70vh] w-full max-w-full object-contain"
              style={{ aspectRatio: `${width} / ${height}` }}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button onClick={() => exportImage("image/png")} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              تصدير PNG
            </Button>
            <Button variant="outline" onClick={() => exportImage("image/jpeg")} disabled={busy}>
              <Download className="size-4" /> تصدير JPG
            </Button>
            <ExportQuality value={quality} onChange={setQuality} withPrint={false} />
          </div>
          <p className="text-xs text-muted-foreground">
            الحجم النهائي: {Math.round(width * scaleOf(quality))}×{Math.round(height * scaleOf(quality))}{" "}
            بكسل
          </p>
        </div>

        <div className="grid h-fit gap-4">
          <div className="surface grid gap-3 p-4">
            <Label>القالب</Label>
            <div className="grid grid-cols-3 gap-2">
              {COLLAGE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={`rounded-lg border p-2 text-xs transition-colors ${
                    templateId === t.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <span className="relative block h-12 w-full overflow-hidden rounded bg-muted">
                    {t.cells.map((c, i) => (
                      <span
                        key={i}
                        className="absolute rounded-[2px] bg-primary/50"
                        style={{
                          left: `${c.x * 100}%`,
                          top: `${c.y * 100}%`,
                          width: `calc(${c.w * 100}% - 2px)`,
                          height: `calc(${c.h * 100}% - 2px)`,
                        }}
                      />
                    ))}
                  </span>
                  <span className="mt-1 block">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="surface grid gap-3 p-4">
            <Label>مقاس الإخراج</Label>
            <select
              value={sizeId}
              onChange={(e) => {
                setSizeId(e.target.value);
                setCustomW(0);
                setCustomH(0);
              }}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {SIZE_PRESETS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.w}×{s.h}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label>عرض مخصص</Label>
                <input
                  type="number"
                  min={0}
                  value={customW || ""}
                  placeholder={String(preset.w)}
                  onChange={(e) => setCustomW(Number(e.target.value) || 0)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="grid gap-1">
                <Label>ارتفاع مخصص</Label>
                <input
                  type="number"
                  min={0}
                  value={customH || ""}
                  placeholder={String(preset.h)}
                  onChange={(e) => setCustomH(Number(e.target.value) || 0)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="surface grid gap-3 p-4">
            <Label>التنسيق العام</Label>
            <Range label={`المسافة بين الصور: ${gap}`} value={gap} min={0} max={60} onChange={setGap} />
            <Range
              label={`الحواف الخارجية: ${padding}`}
              value={padding}
              min={0}
              max={120}
              onChange={setPadding}
            />
            <Range
              label={`استدارة الزوايا: ${radius}`}
              value={radius}
              min={0}
              max={80}
              onChange={setRadius}
            />
            <Range
              label={`سماكة الإطار: ${borderWidth}`}
              value={borderWidth}
              min={0}
              max={20}
              onChange={setBorderWidth}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>لون الخلفية</Label>
                <input
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
                />
              </div>
              <div className="grid gap-1">
                <Label>لون الإطار</Label>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-input bg-background p-1"
                />
              </div>
            </div>
          </div>

          {slots.length > 0 && (
            <div className="surface grid gap-3 p-4">
              <Label>الصور ({slots.length})</Label>
              <div className="flex flex-wrap gap-2">
                {slots.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`relative size-14 overflow-hidden rounded-lg border-2 ${
                      active === i ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={s.src} alt="" className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] text-white">
                      {i + 1}
                    </span>
                  </button>
                ))}
              </div>

              {current && (
                <div className="grid gap-3 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => moveSlot(active, -1)}>
                      تقديم
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => moveSlot(active, 1)}>
                      تأخير
                    </Button>
                    <Button
                      size="sm"
                      variant={current.fit === "cover" ? "default" : "outline"}
                      onClick={() => patchSlot(active, { fit: "cover" })}
                    >
                      تعبئة
                    </Button>
                    <Button
                      size="sm"
                      variant={current.fit === "contain" ? "default" : "outline"}
                      onClick={() => patchSlot(active, { fit: "contain" })}
                    >
                      احتواء
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeSlot(active)} aria-label="حذف">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  <Range
                    label={`التكبير: ${current.zoom.toFixed(2)}×`}
                    value={current.zoom * 100}
                    min={50}
                    max={300}
                    onChange={(v) => patchSlot(active, { zoom: v / 100 })}
                  />
                  <Range
                    label={`الإزاحة الأفقية: ${Math.round(current.offsetX)}%`}
                    value={current.offsetX + 100}
                    min={0}
                    max={200}
                    onChange={(v) => patchSlot(active, { offsetX: v - 100 })}
                  />
                  <Range
                    label={`الإزاحة العمودية: ${Math.round(current.offsetY)}%`}
                    value={current.offsetY + 100}
                    min={0}
                    max={200}
                    onChange={(v) => patchSlot(active, { offsetY: v - 100 })}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => patchSlot(active, { zoom: 1, offsetX: 0, offsetY: 0 })}
                  >
                    إعادة الضبط
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
