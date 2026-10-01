import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ArrowLeft, Download, Images, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "../../components/PrivacyNote";
import { UploadZone } from "../../components/UploadZone";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { canvasToBlob, loadImageFromFile, uid } from "../../lib/certificate";
import {
  COLLAGE_TEMPLATES,
  QUALITIES,
  RATIOS,
  gridTemplate,
  renderCollage,
  type Anchor,
  type CollageItem,
  type Fit,
} from "../../lib/collage";
import { downloadBlob } from "../../lib/save";

export const Route = createFileRoute("/tools/collage")({
  head: () => ({
    meta: [
      { title: "تجميع الصور في قوالب — منصة الأستاذ" },
      {
        name: "description",
        content:
          "اجمع عدة صور في قالب واحد، حدّد المحاذاة والتكبير والفواصل، ثم صدّر الصورة بدقة عالية تصل إلى 6000 بكسل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "تجميع الصور في قوالب — منصة الأستاذ" },
      {
        property: "og:description",
        content: "قوالب جاهزة لتجميع الصور ومحاذاتها وتصديرها بدقة عالية داخل متصفحك.",
      },
    ],
  }),
  component: PhotoCollage,
});

const ANCHORS: { id: Anchor; name: string }[] = [
  { id: "center", name: "الوسط" },
  { id: "top", name: "الأعلى" },
  { id: "bottom", name: "الأسفل" },
  { id: "start", name: "اليمين" },
  { id: "end", name: "اليسار" },
];

type ExportFormat = "png" | "jpeg" | "webp" | "pdf";
const FORMATS: { id: ExportFormat; name: string }[] = [
  { id: "png", name: "صورة PNG (أعلى جودة)" },
  { id: "jpeg", name: "صورة JPG (حجم أصغر)" },
  { id: "webp", name: "صورة WEBP" },
  { id: "pdf", name: "ملف PDF" },
];

function PhotoCollage() {
  const [items, setItems] = useState<CollageItem[]>([]);
  const [templateId, setTemplateId] = useState("grid-2x2");
  const [customRows, setCustomRows] = useState(2);
  const [customColumns, setCustomColumns] = useState(2);
  const [ratioId, setRatioId] = useState<string>("1-1");
  const [qualityId, setQualityId] = useState<string>("print");
  const [customWidth, setCustomWidth] = useState(3000);
  const [customHeight, setCustomHeight] = useState(3000);
  const [lockRatio, setLockRatio] = useState(true);
  const [useCustom, setUseCustom] = useState(false);
  const [gap, setGap] = useState(0);
  const [padding, setPadding] = useState(0);
  const [radius, setRadius] = useState(0);
  const [background, setBackground] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [jpegQuality, setJpegQuality] = useState(0.95);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const template = templateId === "custom"
    ? gridTemplate(customRows, customColumns)
    : (COLLAGE_TEMPLATES.find((t) => t.id === templateId) ?? COLLAGE_TEMPLATES[0]!);
  const ratio = RATIOS.find((r) => r.id === ratioId)?.value ?? 1;
  const exportWidth = useCustom
    ? Math.min(8000, Math.max(300, Math.round(customWidth) || 300))
    : (QUALITIES.find((q) => q.id === qualityId)?.width ?? 3000);
  const exportHeight = useCustom && !lockRatio
    ? Math.min(8000, Math.max(300, Math.round(customHeight) || 300))
    : Math.round(exportWidth / ratio);
  const exportRatio = exportWidth / exportHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderCollage(canvas, {
      width: 1000,
      ratio: exportRatio,
      template,
      items,
      gap,
      padding,
      radius,
      background,
    });
  }, [items, template, exportRatio, gap, padding, radius, background]);

  const onFiles = async (files: File[]) => {
    try {
      const loaded = await Promise.all(
        files.map(async (file) => {
          const image = await loadImageFromFile(file);
          return {
            id: uid(),
            name: file.name,
            image,
            fit: "contain" as Fit,
            anchor: "center" as Anchor,
            zoom: 1,
          };
        }),
      );
      setItems((prev) => [...prev, ...loaded]);
      toast.success(`أُضيفت ${loaded.length} صورة`);
    } catch {
      toast.error("تعذر قراءة بعض الصور");
    }
  };

  const patch = (id: string, p: Partial<CollageItem>) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...p } : item)));

  const move = (index: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const exportImage = async (format: ExportFormat = exportFormat) => {
    if (!items.length) {
      toast.error("أضف صورة واحدة على الأقل");
      return;
    }
    if (exportWidth * exportHeight > 64_000_000) {
      toast.error("الأبعاد كبيرة جداً؛ اختر مقاساً أو دقة أقل (حتى ٦٤ مليون بكسل)");
      return;
    }
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      renderCollage(canvas, {
        width: exportWidth,
        ratio: exportRatio,
        template,
        items,
        gap,
        padding,
        radius,
        background,
      });
      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const landscape = canvas.width >= canvas.height;
        const pdf = new jsPDF({
          unit: "px",
          format: [canvas.width, canvas.height],
          orientation: landscape ? "landscape" : "portrait",
        });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", 0, 0, canvas.width, canvas.height);
        pdf.save(`تجميع-صور-${canvas.width}x${canvas.height}.pdf`);
      } else {
        const mime = `image/${format}` as "image/png" | "image/jpeg" | "image/webp";
        const blob = await canvasToBlob(canvas, mime, format === "png" ? 1 : jpegQuality);
        const extension = format === "jpeg" ? "jpg" : format;
        downloadBlob(blob, `تجميع-صور-${canvas.width}x${canvas.height}.${extension}`);
      }
      toast.success(`تم التصدير بدقة ${canvas.width}×${canvas.height}`);
    } catch {
      toast.error("تعذر تصدير الصورة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10">
      <PageHeader
        icon={<Images className="size-6" />}
        title="تجميع الصور"
        description="اختر قالباً، أضف صورك، اضبط المحاذاة والتكبير والفواصل، ثم صدّر بدقة عالية أو مخصصة."
      />

      <UploadZone
        accept="image/*"
        multiple
        title="أضف الصور (يمكن اختيار عدة صور)"
        hint="PNG · JPG · WebP — تُرتّب الصور حسب خانات القالب"
        onFiles={onFiles}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-3">
          <div className="surface overflow-hidden p-3">
            <canvas ref={canvasRef} className="mx-auto block h-auto w-full rounded-lg" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => exportImage()} disabled={busy}>
              <Download className="size-4" /> تصدير
            </Button>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              aria-label="صيغة التصدير"
            >
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {(exportFormat === "jpeg" || exportFormat === "webp") && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                جودة {Math.round(jpegQuality * 100)}%
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(Number(e.target.value))}
                />
              </label>
            )}
            {items.length > 0 && (
              <Button variant="ghost" onClick={() => setItems([])}>
                تفريغ الصور
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            مقاس الصورة النهائية: {exportWidth}×{exportHeight} بكسل ({(exportWidth * exportHeight / 1_000_000).toFixed(1)} ميغابكسل) — خانات القالب:{" "}
            {template.cells.length} / الصور المضافة: {items.length}
          </p>
        </div>

        <div className="surface grid h-fit gap-5 p-5">
          <div className="grid gap-2">
            <Label>القالب</Label>
            <div className="grid grid-cols-2 gap-2">
              {COLLAGE_TEMPLATES.map((t) => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={t.id === templateId ? "default" : "outline"}
                  onClick={() => setTemplateId(t.id)}
                >
                  {t.name}
                </Button>
              ))}
              <Button
                size="sm"
                variant={templateId === "custom" ? "default" : "outline"}
                onClick={() => setTemplateId("custom")}
              >
                تقسيم مخصص
              </Button>
            </div>
            {templateId === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="grid gap-1 text-sm">
                  عدد الصفوف
                  <input type="number" min={1} max={8} value={customRows}
                    onChange={(e) => setCustomRows(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3" />
                </label>
                <label className="grid gap-1 text-sm">
                  عدد الأعمدة
                  <input type="number" min={1} max={8} value={customColumns}
                    onChange={(e) => setCustomColumns(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3" />
                </label>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="collage-ratio">نسبة أبعاد الصورة</Label>
            <select
              id="collage-ratio"
              value={ratioId}
              onChange={(e) => setRatioId(e.target.value)}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {RATIOS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="collage-resolution">دقة الصورة النهائية</Label>
            <select
              id="collage-resolution"
              value={useCustom ? "custom" : qualityId}
              onChange={(e) => {
                if (e.target.value === "custom") setUseCustom(true);
                else {
                  setUseCustom(false);
                  setQualityId(e.target.value);
                }
              }}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            >
              {QUALITIES.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
              <option value="custom">دقة مخصصة…</option>
            </select>
            {useCustom && (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid min-w-0 gap-1 text-sm">
                    العرض (بكسل)
                    <input type="number" min={300} max={8000} step={1} value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      className="h-11 min-w-0 w-full rounded-lg border border-border bg-background px-3" dir="ltr" />
                  </label>
                  <label className="grid min-w-0 gap-1 text-sm">
                    الارتفاع (بكسل)
                    <input type="number" min={300} max={8000} step={1} value={lockRatio ? exportHeight : customHeight}
                      disabled={lockRatio}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      className="h-11 min-w-0 w-full rounded-lg border border-border bg-background px-3 disabled:opacity-60" dir="ltr" />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={lockRatio} onChange={(e) => {
                    if (!e.target.checked) setCustomHeight(exportHeight);
                    setLockRatio(e.target.checked);
                  }} />
                  تثبيت نسبة الأبعاد
                </label>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <Label>الفراغ بين الصور: {(gap * 100).toFixed(1)}%</Label>
            <input
              type="range"
              min={0}
              max={0.06}
              step={0.002}
              value={gap}
              onChange={(e) => setGap(Number(e.target.value))}
            />
            <Label>الحاشية الخارجية: {(padding * 100).toFixed(1)}%</Label>
            <input
              type="range"
              min={0}
              max={0.08}
              step={0.002}
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
            />
            <Label>تدوير الزوايا: {(radius * 100).toFixed(1)}%</Label>
            <input
              type="range"
              min={0}
              max={0.06}
              step={0.002}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
            <Label>لون الخلفية</Label>
            <input
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background"
            />
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display font-bold">الصور وترتيبها</h2>
          {items.map((item, index) => (
            <div key={item.id} className="surface grid gap-3 p-4 sm:grid-cols-[96px_1fr]">
              <img
                src={item.image.src}
                alt={item.name}
                className="h-24 w-full rounded-lg object-cover"
              />
              <div className="grid gap-2">
                <span className="truncate text-sm font-medium">
                  {index + 1}. {item.name}
                  {index >= template.cells.length && (
                    <span className="text-xs text-muted-foreground"> — خارج القالب الحالي</span>
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={item.fit}
                    onChange={(e) => patch(item.id, { fit: e.target.value as Fit })}
                    className="h-10 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    <option value="cover">تعبئة الخانة</option>
                    <option value="contain">إظهار الصورة كاملة</option>
                  </select>
                  <select
                    value={item.anchor}
                    onChange={(e) => patch(item.id, { anchor: e.target.value as Anchor })}
                    className="h-10 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    {ANCHORS.map((a) => (
                      <option key={a.id} value={a.id}>
                        محاذاة: {a.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    تكبير {item.zoom.toFixed(2)}×
                    <input
                      type="range"
                      min={1}
                      max={2.5}
                      step={0.05}
                      value={item.zoom}
                      onChange={(e) => patch(item.id, { zoom: Number(e.target.value) })}
                    />
                  </label>
                  <Button variant="outline" size="sm" onClick={() => move(index, -1)}>
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => move(index, 1)}>
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                  >
                    <Trash2 className="size-4" /> حذف
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
